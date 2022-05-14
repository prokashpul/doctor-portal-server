const express = require("express");
const cors = require("cors");
require("dotenv").config();
const { MongoClient, ServerApiVersion } = require("mongodb");
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

const run = async () => {
  try {
    await client.connect();
    const serviceCollection = client.db("doctor_portal").collection("services");
    const bookingCollection = client.db("booking").collection("booking");

    // get service api
    app.get("/services", async (req, res) => {
      const query = {};
      const cursor = serviceCollection.find(query);
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
        treatment: booking.treatment,
        date: booking.date,
        email: booking.email,
      };
      const exists = await bookingCollection.findOne(query);
      if (exists) {
        return res.send({ success: false, booking: exists });
      }
      const result = await bookingCollection.insertOne(booking);
      res.send({ success: true, booking: result });
    });
    // booking get api create
    app.get("/booking", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const bookings = await bookingCollection?.find(query).toArray();
      res.send(bookings);
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
