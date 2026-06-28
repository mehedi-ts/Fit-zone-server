const express = require("express");
const cors = require("cors");
const app = express();
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const { createRemoteJWKSet, jwtVerify } = require("jose-cjs");
app.use(cors());
app.use(express.json());
dotenv.config();

const port = process.env.PORT || 5000;
const MONGODB_URI = process.env.MONGODB_URI;

const client = new MongoClient(MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

//jwt

const JWKS = createRemoteJWKSet(
  new URL(`${process.env.CLIENT_URL}/api/auth/jwks`),
);

const verifyToken = async (req, res, next) => {
  const authHeader = req?.headers.authorization;
  if (!authHeader || !authHeader.startsWith("Bearer")) {
    return res.status(401).json({ message: "Unauthorized" });
  }
  const token = authHeader.split(" ")[1];
  if (!token) {
    return res.status(401).json({ message: "Unauthorized" });
  }

  try {
    const { payload } = await jwtVerify(token, JWKS);
    console.log(payload);
    req.user = payload;

    next();
  } catch (error) {
    return res.status(403).json({ message: "Forbidden" });
  }
};

//jwt

async function run() {
  try {
    // await client.connect();
    //database collections are created here
    const db = client.db("fitzone");
    const usersCollection = db.collection("user");
    const classesCollection = db.collection("classes");
    const forumsCollection = db.collection("forums");
    const bookingsCollection = db.collection("bookings");
    const trainerApplicationsCollection = db.collection("trainerApplications");
    const favoritesCollection = db.collection("favoritesClasses");
    const likesCollection = db.collection("likes");
const commentsCollection = db.collection("comments");

    ///
    const checkBlockedUser = async (req, res, next) => {
      try {
        const email = req.user.email;

        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        if (user.status === "blocked") {
          return res.status(403).json({
            success: false,
            message: "Your account has been blocked.",
          });
        }

        next();
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    };
    const verifyAdmin = async (req, res, next) => {
      try {
        const email = req.user.email;

        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        if (user.role !== "admin") {
          return res.status(403).json({
            success: false,
            message: "Admin access only.",
          });
        }

        next();
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    };
    const verifyTrainer = async (req, res, next) => {
      try {
        const email = req.user.email;

        const user = await usersCollection.findOne({ email });

        if (!user) {
          return res.status(404).json({
            success: false,
            message: "User not found",
          });
        }

        if (user.role !== "trainer") {
          return res.status(403).json({
            success: false,
            message: "Trainer access only.",
          });
        }

        next();
      } catch (error) {
        return res.status(500).json({
          success: false,
          message: error.message,
        });
      }
    };
    ///

    //database collections are ended here
    //---------------------------------------
    //api routes are created here

    // this api is public not protected with jwt token
    app.post("/api/classes", verifyToken, verifyTrainer, async (req, res) => {
      try {
        const newClass = req.body;

        const result = await classesCollection.insertOne(newClass);

        if (!result.insertedId) {
          return res.status(400).send({
            success: false,
            message: "Class not created",
          });
        }

        res.status(201).send({
          success: true,
          message: "Class created successfully",
          insertedId: result.insertedId,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message || "Server error",
        });
      }
    });
    app.post("/api/forums", async (req, res) => {
      const newForum = req.body;
      const result = await forumsCollection.insertOne(newForum);
      res.send(result);
    });
    app.get("/api/forums", async (req, res) => {
      const result = await forumsCollection.find().toArray();
      res.send(result);
    });
    app.get("/api/forums/:id", async (req, res) => {
      try {
        const { id } = req.params;

        const forum = await forumsCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!forum) {
          return res.status(404).send({
            success: false,
            message: "Forum not found",
          });
        }

        res.send(forum);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    app.get("/api/forum/latest", async (req, res) => {
      try {
        const limitCount = parseInt(req.query.limit) || 3;

        const result = await forumsCollection
          .find()
          .sort({ createdAt: -1 })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: "Latest forum posts problem",
          error: error.message,
        });
      }
    });
app.get("/api/classes", async (req, res) => {
  try {
    const { search, category, page = 1, limit = 6 } = req.query;

    const pageNum = Math.max(parseInt(page) || 1, 1);
    const limitNum = Math.max(parseInt(limit) || 6, 1);
    const skip = (pageNum - 1) * limitNum;

    let matchQuery = {
      status: "approved",
    };

    if (search) {
      matchQuery.className = {
        $regex: search,
        $options: "i",
      };
    }

    if (category) {
      matchQuery.category = {
        $regex: `^${category}$`,
        $options: "i",
      };
    }

    const totalCount = await classesCollection.countDocuments(matchQuery);

    const result = await classesCollection
      .aggregate([
        { $match: matchQuery },
        { $skip: skip },
        { $limit: limitNum },
        {
          $lookup: {
            from: "bookings",
            let: { classId: { $toString: "$_id" } },
            pipeline: [
              {
                $match: {
                  $expr: {
                    $and: [
                      { $eq: ["$classId", "$$classId"] },
                      { $eq: ["$paymentStatus", "paid"] },
                    ],
                  },
                },
              },
            ],
            as: "bookings",
          },
        },
        {
          $addFields: {
            bookingCount: { $size: "$bookings" },
          },
        },
        {
          $project: {
            bookings: 0,
          },
        },
      ])
      .toArray();

    res.send({
      classes: result,
      totalCount,
      totalPages: Math.ceil(totalCount / limitNum),
      currentPage: pageNum,
    });
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});
    app.get("/api/classes/featured", async (req, res) => {
      try {
        const result = await classesCollection
          .aggregate([
            // শুধু approved class
            {
              $match: {
                status: "approved",
              },
            },

            // booking lookup
            {
              $lookup: {
                from: "bookings",
                let: {
                  classId: { $toString: "$_id" },
                },
                pipeline: [
                  {
                    $match: {
                      $expr: {
                        $and: [
                          { $eq: ["$classId", "$$classId"] },
                          { $eq: ["$paymentStatus", "paid"] },
                        ],
                      },
                    },
                  },
                ],
                as: "bookings",
              },
            },

            // booking count + _id কে string এ convert
            {
              $addFields: {
                id: { $toString: "$_id" },
                bookingCount: {
                  $size: "$bookings",
                },
              },
            },

            // বেশি booking যেগুলোর, সেগুলো আগে
            {
              $sort: {
                bookingCount: -1,
              },
            },

            // ৮টা class (loop mode এর জন্য slidesPerView * 2 দরকার)
            {
              $limit: 6,
            },

            // bookings array response থেকে বাদ
            {
              $project: {
                bookings: 0,
              },
            },
          ])
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    //this api is protected with jwt token
    app.get("/api/classes/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await classesCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!result) {
          return res.status(404).send({ message: "Class not found" });
        }

        res.send(result);
      } catch (error) {
        res.status(500).send({
          message: "Failed to fetch class",
          error: error.message,
        });
      }
    });
    app.get(
  "/api/classes/trainer/:trainerId",
  verifyToken,
  async (req, res) => {
    try {
      const trainerId = req.params.trainerId;

      const result = await classesCollection
        .aggregate([
          { $match: { trainerId } },
          {
            $lookup: {
              from: "bookings",
              let: { classId: { $toString: "$_id" } },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$classId", "$$classId"] },
                        { $eq: ["$paymentStatus", "paid"] },
                      ],
                    },
                  },
                },
                {
                  $project: {
                    name: 1,
                    email: 1,
                    _id: 0,
                  },
                },
              ],
              as: "students",
            },
          },
        ])
        .toArray();

      res.send(result);
    } catch (error) {
      res.status(500).send({
        success: false,
        message: error.message,
      });
    }
  },
);
    app.get(
      "/api/forums/user/:userId",
      verifyToken,

      async (req, res) => {
        const userId = req.params.userId;
        const query = {
          authorId: userId,
        };
        const result = await forumsCollection.find(query).toArray();
        res.send(result);
      },
    );
    //api routes are ended here
    //---------------------------------------

    // booking api is created here
    app.get("/api/check-booked", verifyToken, async (req, res) => {
      const { classId, userId } = req.query;

      const booking = await bookingsCollection.findOne({
        classId,
        userId,
      });

      res.send({
        alreadyBooked: !!booking,
      });
    });

    app.post(
      "/api/bookings",
      verifyToken,
      checkBlockedUser,
      async (req, res) => {
        try {
          const newBooking = req.body;

          const { classId, email } = newBooking;

          const existingBooking = await bookingsCollection.findOne({
            classId,
            email,
          });

          if (existingBooking) {
            return res.send({
              success: true,
              alreadyBooked: true,
              message: "Already booked",
            });
          }

          // ✅ date add করো
          newBooking.createdAt = new Date();

          const result = await bookingsCollection.insertOne(newBooking);

          res.send({
            success: true,
            alreadyBooked: false,
            message: "Booking successful",
            result,
          });
        } catch (error) {
          res.status(500).send({
            success: false,
            message: error.message,
          });
        }
      },
    );
    app.get("/api/bookings/user/:userId", verifyToken, async (req, res) => {
      try {
        const userId = req.params.userId;

        const result = await bookingsCollection
          .aggregate([
            {
              $match: { userId },
            },
            {
              $addFields: {
                classObjectId: {
                  $toObjectId: "$classId",
                },
              },
            },
            {
              $lookup: {
                from: "classes",
                localField: "classObjectId",
                foreignField: "_id",
                as: "classInfo",
              },
            },
            {
              $unwind: {
                path: "$classInfo",
                preserveNullAndEmptyArrays: true,
              },
            },
            {
              $project: {
                classObjectId: 0,
              },
            },
          ])
          .toArray();

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({
          success: false,
          message: "Failed to fetch bookings",
        });
      }
    });
    //--------------------------------

    // api for user

    app.post(
      "/api/apply-trainer",
      verifyToken,
      checkBlockedUser,
      async (req, res) => {
        try {
          const application = req.body;

          const existingApplication =
            await trainerApplicationsCollection.findOne({
              userId: application.userId,
            });

          if (existingApplication) {
            return res.status(409).send({
              success: false,
              message: "You have already applied as a trainer",
            });
          }

          application.status = "pending";
          application.createdAt = new Date();

          const result =
            await trainerApplicationsCollection.insertOne(application);

          res.send({
            success: true,
            result,
          });
        } catch (error) {
          res.status(500).send({
            success: false,
            message: error.message,
          });
        }
      },
    );
    app.get(
      "/api/trainer-application/user/:userId",
      verifyToken,
      async (req, res) => {
        try {
          const userId = req.params.userId;

          const result = await trainerApplicationsCollection.findOne({
            userId,
          });

          res.send(result || {});
        } catch (error) {
          console.error(error);

          res.status(500).send({
            success: false,
            message: "Failed to fetch trainer application",
          });
        }
      },
    );

    app.post("/favorites", verifyToken, checkBlockedUser, async (req, res) => {
      try {
        const { userId, classId } = req.body;

        const alreadyExist = await favoritesCollection.findOne({
          userId,
          classId,
        });

        if (alreadyExist) {
          return res.send({
            success: false,
            message: "Already added",
          });
        }

        const result = await favoritesCollection.insertOne({
          userId,
          classId,
          createdAt: new Date(),
        });

        res.send({
          success: true,
          message: "Added to favorites",
          result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
    app.delete(
      "/favorites",
      verifyToken,
      checkBlockedUser,
      async (req, res) => {
        try {
          const { userId, classId } = req.body;

          const result = await favoritesCollection.deleteOne({
            userId,
            classId,
          });

          if (result.deletedCount === 0) {
            return res.status(404).send({
              success: false,
              message: "Favorite not found",
            });
          }

          res.send({
            success: true,
            message: "Removed from favorites",
            result,
          });
        } catch (error) {
          res.status(500).send({
            success: false,
            message: error.message,
          });
        }
      },
    );

    app.get("/favorites/check", verifyToken, async (req, res) => {
      try {
        const { classId, userId } = req.query;

        const result = await favoritesCollection.findOne({ userId, classId });

        res.send({
          success: true,
          isFavorited: !!result,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
    app.get("/favorites/:userId", verifyToken, async (req, res) => {
      try {
        const userId = req.params.userId;

        const favorites = await favoritesCollection
          .find({
            userId,
          })
          .toArray();

        const classIds = favorites.map((item) => new ObjectId(item.classId));

        const classes = await classesCollection
          .find({
            _id: {
              $in: classIds,
            },
          })
          .toArray();

        res.send(classes);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
    app.delete("/favorites/:id", async (req, res) => {
      try {
        const id = req.params.id;

        const result = await favoritesCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        console.error(error);
        res.status(500).send({
          success: false,
          message: "Failed to delete favorite class",
        });
      }
    });
    // api for admin
app.get("/admin/classes",verifyToken,verifyAdmin, async (req, res) => {
  const result = await classesCollection.find().toArray();
  res.send(result);
});


    app.get("/api/users", verifyToken, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.patch(
      "/users/:id/block",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const { id } = req.params;

          const result = await usersCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $set: {
                status: "blocked",
              },
            },
          );

          res.send(result);
        } catch (error) {
          res.status(500).send({
            success: false,
            message: error.message,
          });
        }
      },
    );
    app.patch(
      "/users/:id/unblock",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const { id } = req.params;

          const result = await usersCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $set: {
                status: "active",
              },
            },
          );

          res.send(result);
        } catch (error) {
          res.status(500).send({
            success: false,
            message: error.message,
          });
        }
      },
    );
    app.patch(
      "/users/:id/make-admin",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const { id } = req.params;

          const result = await usersCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $set: {
                role: "admin",
              },
            },
          );

          res.send(result);
        } catch (error) {
          res.status(500).send({
            success: false,
            message: error.message,
          });
        }
      },
    );

    app.get(
      "/api/trainer-applications/pending",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const result = await trainerApplicationsCollection
            .find({ status: "pending" })
            .sort({ createdAt: -1 })
            .toArray();

          res.send(result);
        } catch (error) {
          res.status(500).send({ message: error.message });
        }
      },
    );
    app.patch(
      "/trainer-applications/:id/approve",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const { id } = req.params;

          const application = await trainerApplicationsCollection.findOne({
            _id: new ObjectId(id),
          });

          if (!application) {
            return res.status(404).send({ message: "Application not found" });
          }

          await usersCollection.updateOne(
            { _id: new ObjectId(application.userId) },
            {
              $set: {
                role: "trainer",
              },
            },
          );

          const result = await trainerApplicationsCollection.updateOne(
            { _id: new ObjectId(id) },
            {
              $set: {
                status: "Approved",
              },
            },
          );

          res.send(result);
        } catch (error) {
          res.status(500).send({
            message: error.message,
          });
        }
      },
    );
    app.patch(
      "/trainer-applications/:id/reject",
      verifyToken,
      verifyAdmin,
      async (req, res) => {
        try {
          const { id } = req.params;
          const { feedback } = req.body;

          const result = await trainerApplicationsCollection.updateOne(
            {
              _id: new ObjectId(id),
            },
            {
              $set: {
                status: "Rejected",
                feedback,
              },
            },
          );

          res.send(result);
        } catch (error) {
          res.status(500).send({
            message: error.message,
          });
        }
      },
    );

    // GET all trainers (users with role "Trainer")
    app.get("/api/trainers", async (req, res) => {
      try {
        const result = await usersCollection
          .find({ role: "trainer" })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // PATCH demote trainer to regular user
    app.patch("/trainers/:id/demote",verifyToken,verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              role: "member",
            },
          },
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
    // PATCH approve a pending class
    app.patch("/classes/:id/approve",verifyToken,verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;

        const result = await classesCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "approved",
            },
          },
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // PATCH reject a pending class
    app.patch("/classes/:id/reject",verifyToken,verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;

        const result = await classesCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              status: "rejected",
            },
          },
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // DELETE a class
    app.delete("/classes/:id",verifyToken,verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;

        const result = await classesCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // DELETE a forum post
    app.delete("/api/forums/:id",verifyToken,verifyAdmin, async (req, res) => {
      try {
        const { id } = req.params;

        const result = await forumsCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
    // GET all transactions (bookings with payment info)
    app.get("/api/transactions",verifyToken,verifyAdmin, async (req, res) => {
      try {
        const result = await bookingsCollection
          .find({ stripeSessionId: { $exists: true } })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    /////////////////////////////////////////////////////////////////////////////////////////////////
    // ============ LIKES ============

// Get like/dislike summary + current user's vote for a forum
app.get("/api/forums/:forumId/likes", async (req, res) => {
  try {
    const { forumId } = req.params;
    const { userId } = req.query;

    const likesCount = await likesCollection.countDocuments({
      forumId,
      type: "like",
    });
    const dislikesCount = await likesCollection.countDocuments({
      forumId,
      type: "dislike",
    });

    let userVote = null;
    if (userId) {
      const existing = await likesCollection.findOne({ forumId, userId });
      userVote = existing?.type || null;
    }

    res.send({ likesCount, dislikesCount, userVote });
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// Toggle like or dislike for a forum
app.post("/api/forums/:forumId/likes", async (req, res) => {
  try {
    const { forumId } = req.params;
    const { userId, type } = req.body; // type: "like" | "dislike"

    if (!userId || !["like", "dislike"].includes(type)) {
      return res.status(400).send({ message: "Invalid request" });
    }

    const existing = await likesCollection.findOne({ forumId, userId });

    if (!existing) {
      // No previous vote -> create one
      await likesCollection.insertOne({
        forumId,
        userId,
        type,
        createdAt: new Date(),
      });
    } else if (existing.type === type) {
      // Same vote clicked again -> remove (un-vote)
      await likesCollection.deleteOne({ _id: existing._id });
    } else {
      // Switching vote (like -> dislike or vice versa)
      await likesCollection.updateOne(
        { _id: existing._id },
        { $set: { type } }
      );
    }

    const likesCount = await likesCollection.countDocuments({
      forumId,
      type: "like",
    });
    const dislikesCount = await likesCollection.countDocuments({
      forumId,
      type: "dislike",
    });
    const updated = await likesCollection.findOne({ forumId, userId });

    res.send({
      likesCount,
      dislikesCount,
      userVote: updated?.type || null,
    });
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// ============ COMMENTS ============

// Get all comments for a forum
app.get("/api/forums/:forumId/comments", async (req, res) => {
  try {
    const { forumId } = req.params;

    const comments = await commentsCollection
      .find({ forumId })
      .sort({ createdAt: -1 })
      .toArray();

    res.send(comments);
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// Add a comment to a forum
app.post("/api/forums/:forumId/comments", async (req, res) => {
  try {
    const { forumId } = req.params;
    const { userId, userName, userImage, text } = req.body;

    if (!userId || !text?.trim()) {
      return res.status(400).send({ message: "Invalid request" });
    }

    const comment = {
      forumId,
      userId,
      userName,
      userImage: userImage || null,
      text: text.trim(),
      createdAt: new Date(),
    };

    const result = await commentsCollection.insertOne(comment);

    res.send({ ...comment, _id: result.insertedId });
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});

// Delete a comment (only by the comment's author)
app.delete("/api/forums/comments/:commentId", async (req, res) => {
  try {
    const { commentId } = req.params;
    const { userId } = req.body;

    const comment = await commentsCollection.findOne({
      _id: new ObjectId(commentId),
    });

    if (!comment) {
      return res.status(404).send({ message: "Comment not found" });
    }

    if (comment.userId !== userId) {
      return res.status(403).send({ message: "Not authorized" });
    }

    await commentsCollection.deleteOne({ _id: new ObjectId(commentId) });

    res.send({ deletedCount: 1 });
  } catch (error) {
    res.status(500).send({ message: "Server error" });
  }
});
    
    ////////////////////////////////////////////////////////////////////
    // ============ DASHBOARD STATS ============

    app.get("/api/member-stats/:userId", verifyToken, async (req, res) => {
      try {
        const { userId } = req.params;

        const totalBookedClasses = await bookingsCollection.countDocuments({
          userId,
        });
        const totalFavorites = await favoritesCollection.countDocuments({
          userId,
        });

        res.send({
          totalBookedClasses,
          totalFavorites,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

   app.get(
  "/api/trainer-stats/:trainerId",
  verifyToken,
  verifyTrainer,
  async (req, res) => {
    try {
      const { trainerId } = req.params;
      
      const formattedTrainerId = trainerId.startsWith("TR-")
        ? trainerId
        : `TR-${trainerId}`;

      const totalClassesCreated = await classesCollection.countDocuments({
        trainerId: formattedTrainerId,
      });

      const result = await classesCollection
        .aggregate([
          { $match: { trainerId: formattedTrainerId } },
          {
            $lookup: {
              from: "bookings",
              let: { classId: { $toString: "$_id" } },
              pipeline: [
                {
                  $match: {
                    $expr: {
                      $and: [
                        { $eq: ["$classId", "$$classId"] },
                        { $eq: ["$paymentStatus", "paid"] },
                      ],
                    },
                  },
                },
              ],
              as: "bookings",
            },
          },
          {
            $project: {
              studentCount: { $size: "$bookings" },
            },
          },
          {
            $group: {
              _id: null,
              totalStudentsEnrolled: { $sum: "$studentCount" },
            },
          },
        ])
        .toArray();

      const totalStudentsEnrolled = result[0]?.totalStudentsEnrolled || 0;

      res.send({
        totalClassesCreated,
        totalStudentsEnrolled,
      });
    } catch (error) {
      res.status(500).send({
        success: false,
        message: error.message,
      });
    }
  },
);

    app.get("/api/admin-stats", verifyToken, verifyAdmin, async (req, res) => {
      try {
        const totalUsers = await usersCollection.countDocuments();
        const totalClasses = await classesCollection.countDocuments();
        const totalBookedClasses = await bookingsCollection.countDocuments();

        res.send({
          totalUsers,
          totalClasses,
          totalBookedClasses,
        });
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });

    // ============ END DASHBOARD STATS ============
    
    
    app.delete("/api/classes/:id", verifyToken, async (req, res) => {
      try {
        const { id } = req.params;
        const email = req.user.email;

        const user = await usersCollection.findOne({ email });

        const existingClass = await classesCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!existingClass) {
          return res.status(404).send({
            success: false,
            message: "Class not found",
          });
        }

        const isOwnerTrainer =
          user?.role === "trainer" &&
          existingClass.trainerId === `TR-${user._id.toString()}`;
        const isAdmin = user?.role === "admin";

        if (!isOwnerTrainer && !isAdmin) {
          return res.status(403).send({
            success: false,
            message: "Not authorized to delete this class",
          });
        }

        const result = await classesCollection.deleteOne({
          _id: new ObjectId(id),
        });

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
    app.patch("/classes/:id", verifyToken, verifyTrainer, async (req, res) => {
      try {
        const { id } = req.params;
        const updateData = { ...req.body };
        delete updateData._id;

        const existingClass = await classesCollection.findOne({
          _id: new ObjectId(id),
        });

        if (!existingClass) {
          return res.status(404).send({
            success: false,
            message: "Class not found",
          });
        }

        const trainerId = `TR-${req.user.id}`; // ✅ এটা ঠিক আছে
        if (existingClass.trainerId !== trainerId) {
          return res.status(403).send({
            success: false,
            message: "You can only edit your own classes",
          });
        }

        const result = await classesCollection.updateOne(
          { _id: new ObjectId(id) },
          { $set: updateData },
        );

        res.send(result);
      } catch (error) {
        res.status(500).send({
          success: false,
          message: error.message,
        });
      }
    });
    
    
    
    
    


    //----------------------------------------
    // await client.db("admin").command({ ping: 1 });
    // console.log(
    //   "Pinged your deployment. You successfully connected to MongoDB!",
    // );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("Fit Zone Server is running");
});

app.listen(port, () => {
  console.log(`Fit Zone Server is running on port ${port}`);
});
