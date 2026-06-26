const express = require("express");
const cors = require("cors");
const app = express();
const dotenv = require("dotenv");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
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

async function run() {
  try {
    await client.connect();
    //database collections are created here
    const db = client.db("fitzone");
    const usersCollection = db.collection("user");
    const classesCollection = db.collection("classes");
    const forumsCollection = db.collection("forums");
    const bookingsCollection = db.collection("bookings");
    const trainerApplicationsCollection = db.collection("trainerApplications");
    const favoritesCollection = db.collection("favoritesClasses");

    //database collections are ended here
    //---------------------------------------
    //api routes are created here

    // this api is public not protected with jwt token
    app.post("/api/classes", async (req, res) => {
      const newClass = req.body;
      const result = await classesCollection.insertOne(newClass);
      res.send(result);
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
      const result = await classesCollection.find().toArray();
      res.send(result);
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
    app.get("/api/classes/trainer/:trainerId", async (req, res) => {
      const trainerId = req.params.trainerId;
      const query = {
        trainerId: trainerId,
      };
      const result = await classesCollection.find(query).toArray();
      res.send(result);
    });
    app.get("/api/forums/user/:userId", async (req, res) => {
      const userId = req.params.userId;
      const query = {
        authorId: userId,
      };
      const result = await forumsCollection.find(query).toArray();
      res.send(result);
    });
    //api routes are ended here
    //---------------------------------------

    // booking api is created here
    app.get("/api/check-booked", async (req, res) => {
      const { classId, userId } = req.query;

      const booking = await bookingsCollection.findOne({
        classId,
        userId,
      });

      res.send({
        alreadyBooked: !!booking,
      });
    });

    app.post("/api/bookings", async (req, res) => {
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
    });
    app.get("/api/bookings/user/:userId", async (req, res) => {
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

    app.post("/api/apply-trainer", async (req, res) => {
      try {
        const application = req.body;

        const existingApplication = await trainerApplicationsCollection.findOne(
          {
            userId: application.userId,
          },
        );

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
    });
    app.get("/api/trainer-application/user/:userId", async (req, res) => {
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
    });

    app.post("/favorites", async (req, res) => {
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
    app.delete("/favorites", async (req, res) => {
      try {
        const { userId, classId } = req.body;

        const result = await favoritesCollection.deleteOne({
          userId,
          classId,
        });

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
    });
    app.get("/favorites/:userId", async (req, res) => {
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

    app.get("/api/users", async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });
    app.patch("/users/:id/block", async (req, res) => {
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
    });
    app.patch("/users/:id/unblock", async (req, res) => {
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
    });
    app.patch("/users/:id/make-admin", async (req, res) => {
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
    });

    app.get("/api/trainer-applications/pending", async (req, res) => {
      try {
        const result = await trainerApplicationsCollection
          .find({ status: "pending" })
          .sort({ createdAt: -1 })
          .toArray();

        res.send(result);
      } catch (error) {
        res.status(500).send({ message: error.message });
      }
    });
    app.patch("/trainer-applications/:id/approve", async (req, res) => {
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
    });
    app.patch("/trainer-applications/:id/reject", async (req, res) => {
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
    });

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
    app.patch("/trainers/:id/demote", async (req, res) => {
      try {
        const { id } = req.params;

        const result = await usersCollection.updateOne(
          { _id: new ObjectId(id) },
          {
            $set: {
              role: "user",
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
    app.patch("/classes/:id/approve", async (req, res) => {
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
    app.patch("/classes/:id/reject", async (req, res) => {
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
    app.delete("/classes/:id", async (req, res) => {
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
    app.delete("/api/forums/:id", async (req, res) => {
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
    app.get("/api/transactions", async (req, res) => {
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

    //----------------------------------------
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!",
    );
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
