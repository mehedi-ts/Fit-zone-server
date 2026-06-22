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
    app.get("/api/classes", async (req, res) => {
      const result = await classesCollection.find().toArray();
      res.send(result);
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

        // check already booked
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

        // insert new booking
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
