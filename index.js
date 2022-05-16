const express = require("express");
const cors = require("cors");
require("dotenv").config();
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
// const { application } = require("express");
const app = express();

const port = process.env.PORT || 5000;
//middleware
app.use(cors());
app.use(express.json());

// mongoDB

const uri = `mongodb+srv://${process.env.DB_NAME}:${process.env.DB_PASSWORD}@cluster0.uxlpy.mongodb.net/myFirstDatabase?retryWrites=true&w=majority`;
const client = new MongoClient(uri, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
  serverApi: ServerApiVersion.v1,
});
const verifyJWT = (req, res, next) => {
  const authorization = req.headers?.authorization;
  if (!authorization) {
    return res.status(401).send({ message: "Unauthorize Access" });
  }
  const token = authorization?.split(" ")[1];
  jwt.verify(token, process.env.SECRET_KEY, function (err, decoded) {
    if (err) {
      return res.status(403).send({ message: "Forbidden Access" });
    }
    req.decoded = decoded;
    next();
  });
};

const run = async () => {
  try {
    await client.connect();
    const serviceCollection = client.db("doctor_portal").collection("services");
    const bookingCollection = client.db("doctor_portal").collection("booking");
    const userCollection = client.db("doctor_portal").collection("user");
    const doctorCollection = client.db("doctor_portal").collection("doctors");

    const adminVerify = async (req, res, next) => {
      const decodedEmail = req.decoded.email;
      const required = await userCollection.findOne({ email: decodedEmail });
      if (required.role === "admin") {
        next();
      } else {
        return res.status(403).send({ message: "Forbidden access" });
      }
    };
    // get service api
    app.get("/services", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query).project({ name: 1 });
      const services = await cursor.toArray();
      res.send(services);
    });

    // available service get data
    app.get("/available", async (req, res) => {
      const date = req.query.date;
      // step 1
      const services = await serviceCollection.find().toArray();
      // step 2
      const query = { date: date };
      const booking = await bookingCollection.find(query).toArray();
      //step 3 loop
      services.forEach((service) => {
        const serviceBookings = booking?.filter(
          (book) => book.treatment === service.name
        );
        const bookedSlot = serviceBookings?.map((book) => book.slot);
        const availableSlot = service.slots.filter(
          (slot) => !bookedSlot.includes(slot)
        );
        service.slots = availableSlot;
      });
      res.send(services);
    });
    // booking post api create
    app.post("/booking", async (req, res) => {
      const booking = req.body;
      const query = {
        treatment: booking?.treatment,
        date: booking?.date,
        email: booking?.email,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      } else {
        const result = await bookingCollection.insertOne(booking);
        return res.send({ success: true, result });
      }
    });
    // booking get api create
    app.get("/booking", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const decodedEmail = req.decoded?.email;
      if (decodedEmail === email) {
        const query = { email: email };
        const bookings = await bookingCollection?.find(query).toArray();
        res.send(bookings);
      } else {
        return res.status(403).send({ message: "Forbidden Access" });
      }
    });
    // admin user api
    app.get("/admin/:email", async (req, res) => {
      const email = req.params.email;
      const user = await userCollection.findOne({ email: email });
      const isAdmin = user.role === "admin";
      res.send({ admin: isAdmin });
    });
    //user info update put api create
    app.put("/admin/user/:email", verifyJWT, adminVerify, async (req, res) => {
      const email = req.params.email;

      const filter = { email: email };
      const updateDoc = {
        $set: { role: "admin" },
      };
      const result = await userCollection.updateOne(filter, updateDoc);

      res.send(result);
    });
    //user info update put api create
    app.put("/user/:email", async (req, res) => {
      const email = req.params.email;
      const user = req.body;
      const filter = { email: email };
      const options = { upsert: true };
      const updateDoc = {
        $set: user,
      };
      const result = await userCollection.updateOne(filter, updateDoc, options);
      const token = jwt.sign(filter, process.env.SECRET_KEY, {
        expiresIn: "1h",
      });
      res.send({ result, accessToken: token });
    });

    // user get api create
    app.get("/users", verifyJWT, async (req, res) => {
      const query = {};
      const users = await userCollection.find(query).toArray();
      res.send(users);
    });
    //doctor data post api
    app.post("/doctors", verifyJWT, adminVerify, async (req, res) => {
      const query = req.body;
      const result = await doctorCollection.insertOne(query);
      res.send(result);
    });
    //doctor data post api
    app.get("/doctors", verifyJWT, adminVerify, async (req, res) => {
      const query = {};
      const result = await doctorCollection.find({}).toArray();
      res.send(result);
    });
    //doctor data post api
    app.delete("/doctors/:id", verifyJWT, adminVerify, async (req, res) => {
      const query = req.params.id;
      const doctorId = { _id: ObjectId(query) };
      const result = await doctorCollection.deleteOne(doctorId);
      res.send(result);
    });
  } finally {
  }
};
run().catch(console.dir);

app.get("/", (req, res) => {
  res.send("connect");
});

app.listen(port, () => {
  console.log(port, "connected");
});
