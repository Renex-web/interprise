import express from 'express';
import cors from 'cors';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const app = express();
const PORT = 5000;
const MONGO_URI = 'mongodb://localhost:27017/DAB_Enterprise';
const JWT_SECRET = process.env.JWT_SECRET || 'dab-enterprise-secret-key';

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
app.use(express.json());

mongoose
  .connect(MONGO_URI)
  .then(() => console.log('MongoDB connected:', MONGO_URI))
  .catch((error) => console.error('MongoDB connection error:', error.message));

const userSchema = new mongoose.Schema(
  {
    userId: { type: String, required: true, unique: true, trim: true },
    username: { type: String, required: true, unique: true, trim: true },
    password: { type: String, required: true },
    role: { type: String, default: 'admin' },
  },
  { timestamps: true, collection: 'Users' },
);

const customerSchema = new mongoose.Schema(
  {
    firstname: { type: String, required: true, trim: true },
    lastname: { type: String, required: true, trim: true },
    telephone: { type: String, required: true, trim: true },
    address: { type: String, required: true, trim: true },
  },
  { timestamps: true, collection: 'Customers' },
);

const productSchema = new mongoose.Schema(
  {
    productname: { type: String, required: true, trim: true },
    category: { type: String, required: true, trim: true },
    quantity: { type: Number, required: true, min: 0 },
    unitPrice: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, collection: 'Products' },
);

const orderDetailSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product', required: true },
    productname: String,
    quantity: { type: Number, required: true, min: 1 },
    unitPrice: { type: Number, required: true, min: 0 },
    subtotal: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, collection: 'Order_Details' },
);

const orderSchema = new mongoose.Schema(
  {
    customer: { type: mongoose.Schema.Types.ObjectId, ref: 'Customer', required: true },
    orderDate: { type: Date, default: Date.now },
    totalAmount: { type: Number, required: true, min: 0 },
  },
  { timestamps: true, collection: 'Orders' },
);

const paymentSchema = new mongoose.Schema(
  {
    order: { type: mongoose.Schema.Types.ObjectId, ref: 'Order', required: true },
    amountPaid: { type: Number, required: true, min: 0 },
    paymentDate: { type: Date, default: Date.now },
    paymentMethod: { type: String, required: true },
  },
  { timestamps: true, collection: 'Payments' },
);

const User = mongoose.model('User', userSchema);
const Customer = mongoose.model('Customer', customerSchema);
const Product = mongoose.model('Product', productSchema);
const Order = mongoose.model('Order', orderSchema);
const OrderDetail = mongoose.model('OrderDetail', orderDetailSchema);
const Payment = mongoose.model('Payment', paymentSchema);

const createToken = (user) =>
  jwt.sign({ id: user._id, userId: user.userId, username: user.username, role: user.role }, JWT_SECRET, { expiresIn: '8h' });

const requireAuth = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.replace('Bearer ', '');
    if (!token) return res.status(401).json({ message: 'Authentication required' });
    req.user = jwt.verify(token, JWT_SECRET);
    next();
  } catch {
    res.status(401).json({ message: 'Invalid or expired token' });
  }
};

const sendError = (res, error, fallback = 'Server error') => {
  const message = error?.message || fallback;
  res.status(400).json({ message });
};

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', database: MONGO_URI });
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { userId, username, password, role } = req.body;
    if (!userId || !username || !password) return res.status(400).json({ message: 'User ID, username and password are required' });
    if (password.length < 8) return res.status(400).json({ message: 'Password must be at least 8 characters' });

    const existing = await User.findOne({ $or: [{ userId }, { username }] });
    if (existing) return res.status(409).json({ message: 'User ID or username already exists' });

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = await User.create({ userId, username, password: hashedPassword, role: role || 'admin' });
    res.status(201).json({ token: createToken(user), user: { id: user._id, userId: user.userId, username: user.username, role: user.role } });
  } catch (error) {
    sendError(res, error, 'Registration failed');
  }
});

app.post('/api/auth/login', async (req, res) => {
  try {
    const { userId, password } = req.body;
    const user = await User.findOne({ userId });
    if (!user) return res.status(401).json({ message: 'Invalid user ID or password' });

    const valid = await bcrypt.compare(password, user.password);
    if (!valid) return res.status(401).json({ message: 'Invalid user ID or password' });

    res.json({ token: createToken(user), user: { id: user._id, userId: user.userId, username: user.username, role: user.role } });
  } catch (error) {
    sendError(res, error, 'Login failed');
  }
});

app.get('/api/products', requireAuth, async (req, res) => {
  const search = req.query.search || '';
  const query = search
    ? { $or: [{ productname: new RegExp(search, 'i') }, { category: new RegExp(search, 'i') }] }
    : {};
  res.json(await Product.find(query).sort({ createdAt: -1 }));
});

app.post('/api/products', requireAuth, async (req, res) => {
  try {
    res.status(201).json(await Product.create(req.body));
  } catch (error) {
    sendError(res, error, 'Could not create product');
  }
});

app.put('/api/products/:id', requireAuth, async (req, res) => {
  try {
    res.json(await Product.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }));
  } catch (error) {
    sendError(res, error, 'Could not update product');
  }
});

app.delete('/api/products/:id', requireAuth, async (req, res) => {
  await Product.findByIdAndDelete(req.params.id);
  res.json({ message: 'Product deleted' });
});

app.get('/api/customers', requireAuth, async (req, res) => {
  const search = req.query.search || '';
  const query = search
    ? { $or: [{ firstname: new RegExp(search, 'i') }, { lastname: new RegExp(search, 'i') }, { telephone: new RegExp(search, 'i') }] }
    : {};
  res.json(await Customer.find(query).sort({ createdAt: -1 }));
});

app.post('/api/customers', requireAuth, async (req, res) => {
  try {
    res.status(201).json(await Customer.create(req.body));
  } catch (error) {
    sendError(res, error, 'Could not create customer');
  }
});

app.put('/api/customers/:id', requireAuth, async (req, res) => {
  try {
    res.json(await Customer.findByIdAndUpdate(req.params.id, req.body, { new: true, runValidators: true }));
  } catch (error) {
    sendError(res, error, 'Could not update customer');
  }
});

app.delete('/api/customers/:id', requireAuth, async (req, res) => {
  await Customer.findByIdAndDelete(req.params.id);
  res.json({ message: 'Customer deleted' });
});

app.get('/api/orders', requireAuth, async (req, res) => {
  const orders = await Order.find().populate('customer').sort({ createdAt: -1 });
  const details = await OrderDetail.find({ order: { $in: orders.map((order) => order._id) } }).populate('product');
  res.json(
    orders.map((order) => ({
      ...order.toObject(),
      details: details.filter((detail) => detail.order.toString() === order._id.toString()),
    })),
  );
});

app.post('/api/orders', requireAuth, async (req, res) => {
  try {
    const { customerId, items } = req.body;
    if (!customerId || !items?.length) return res.status(400).json({ message: 'Customer and products are required' });

    let totalAmount = 0;
    const preparedItems = [];

    for (const item of items) {
      const product = await Product.findById(item.productId);
      if (!product) throw new Error('Product not found');
      if (product.quantity < item.quantity) throw new Error(`${product.productname} has only ${product.quantity} in stock`);
      const subtotal = product.unitPrice * Number(item.quantity);
      totalAmount += subtotal;
      preparedItems.push({ product, quantity: Number(item.quantity), subtotal });
    }

    const createdOrder = await Order.create({ customer: customerId, totalAmount });

    for (const item of preparedItems) {
      item.product.quantity -= item.quantity;
      await item.product.save();
      await OrderDetail.create({
        order: createdOrder._id,
        product: item.product._id,
        productname: item.product.productname,
        quantity: item.quantity,
        unitPrice: item.product.unitPrice,
        subtotal: item.subtotal,
      });
    }

    const order = await Order.findById(createdOrder._id).populate('customer');
    const details = await OrderDetail.find({ order: createdOrder._id }).populate('product');
    res.status(201).json({ ...order.toObject(), details });
  } catch (error) {
    sendError(res, error, 'Could not create order');
  }
});

app.get('/api/payments', requireAuth, async (req, res) => {
  res.json(await Payment.find().populate({ path: 'order', populate: { path: 'customer' } }).sort({ createdAt: -1 }));
});

app.post('/api/payments', requireAuth, async (req, res) => {
  try {
    const payment = await Payment.create({
      order: req.body.orderId,
      amountPaid: req.body.amountPaid,
      paymentDate: req.body.paymentDate || new Date(),
      paymentMethod: req.body.paymentMethod,
    });
    res.status(201).json(await payment.populate({ path: 'order', populate: { path: 'customer' } }));
  } catch (error) {
    sendError(res, error, 'Could not record payment');
  }
});

app.get('/api/reports', requireAuth, async (req, res) => {
  const [products, customers, orders, payments] = await Promise.all([
    Product.find().sort({ productname: 1 }),
    Customer.find().sort({ firstname: 1 }),
    Order.find().populate('customer').sort({ createdAt: -1 }),
    Payment.find().populate({ path: 'order', populate: { path: 'customer' } }).sort({ createdAt: -1 }),
  ]);

  const totalSales = orders.reduce((sum, order) => sum + order.totalAmount, 0);
  const totalPaid = payments.reduce((sum, payment) => sum + payment.amountPaid, 0);

  res.json({
    summary: {
      products: products.length,
      customers: customers.length,
      orders: orders.length,
      payments: payments.length,
      totalSales,
      totalPaid,
      outstanding: totalSales - totalPaid,
    },
    availableProducts: products,
    customerOrders: orders,
    payments,
  });
});

app.listen(PORT, () => {
  console.log(`DAB Enterprise API running on http://localhost:${PORT}`);
});
