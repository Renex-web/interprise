import { useEffect, useMemo, useState } from 'react';
import { apiRequest, loginUser, registerUser } from './api';
import './App.css';

const emptyProduct = { productname: '', category: '', quantity: '', unitPrice: '' };
const emptyCustomer = { firstname: '', lastname: '', telephone: '', address: '' };

function money(value) {
  return `RWF ${Number(value || 0).toFixed(2)}`;
}

function date(value) {
  return value ? new Date(value).toLocaleDateString() : '';
}

function printDocument(title, body) {
  const printWindow = window.open('', '_blank', 'width=760,height=900');
  if (!printWindow) return;

  printWindow.document.write(`
    <html>
      <head>
        <title>${title}</title>
        <style>
          body { font-family: Arial, sans-serif; color: #0f172a; padding: 32px; }
          h1 { margin: 0 0 4px; }
          h2 { margin-top: 28px; }
          table { border-collapse: collapse; width: 100%; margin-top: 18px; }
          th, td { border: 1px solid #cbd5e1; padding: 10px; text-align: left; }
          th { background: #f1f5f9; }
          .muted { color: #64748b; }
          .total { text-align: right; font-size: 20px; font-weight: 700; margin-top: 20px; }
        </style>
      </head>
      <body>${body}</body>
    </html>
  `);
  printWindow.document.close();
  printWindow.focus();
  printWindow.print();
}

function printReport(reportType, tableHeaders, tableRows, summary = '') {
  const headerCells = tableHeaders.map((header) => `<th>${header}</th>`).join('');
  const rows = tableRows.length
    ? tableRows.map((row) => `<tr>${row.map((cell) => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')
    : `<tr><td colspan="${tableHeaders.length}">No records available</td></tr>`;

  printDocument(
    `${reportType} Report`,
    `
      <h1>DAB ENTERPRISE REPORT</h1>
      <p><strong>Report Type:</strong> ${reportType}</p>
      <p><strong>Date:</strong> ${new Date().toLocaleDateString()}</p>
      ${summary}
      <table>
        <thead><tr>${headerCells}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
      <div style="margin-top: 72px;">
        <p><strong>Approved by:</strong> ______________________________</p>
        <p style="margin-top: 36px;"><strong>Signature:</strong> ______________________________</p>
      </div>
    `,
  );
}

function App() {
  const savedSession = JSON.parse(localStorage.getItem('dabSession') || 'null');
  const [token, setToken] = useState(savedSession?.token || '');
  const [user, setUser] = useState(savedSession?.user || null);
  const [authMode, setAuthMode] = useState('register');
  const [authForm, setAuthForm] = useState({ userId: '', username: '', password: '' });
  const [message, setMessage] = useState('');
  const [activeTab, setActiveTab] = useState('dashboard');
  const [products, setProducts] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [orders, setOrders] = useState([]);
  const [payments, setPayments] = useState([]);
  const [reports, setReports] = useState(null);
  const [productForm, setProductForm] = useState(emptyProduct);
  const [customerForm, setCustomerForm] = useState(emptyCustomer);
  const [editingProduct, setEditingProduct] = useState('');
  const [editingCustomer, setEditingCustomer] = useState('');
  const [productSearch, setProductSearch] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [orderForm, setOrderForm] = useState({ customerId: '', items: [{ productId: '', quantity: 1 }] });
  const [paymentForm, setPaymentForm] = useState({ orderId: '', amountPaid: '', paymentMethod: 'Cash' });

  const authHeaders = useMemo(
    () => ({
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    }),
    [token],
  );

  const request = async (path, options = {}) => {
    return apiRequest(path, { ...options, headers: options.headers || authHeaders });
  };

  const loadData = async () => {
    if (!token) return;
    try {
      const [productData, customerData, orderData, paymentData, reportData] = await Promise.all([
        request(`/products?search=${encodeURIComponent(productSearch)}`),
        request(`/customers?search=${encodeURIComponent(customerSearch)}`),
        request('/orders'),
        request('/payments'),
        request('/reports'),
      ]);
      setProducts(productData);
      setCustomers(customerData);
      setOrders(orderData);
      setPayments(paymentData);
      setReports(reportData);
    } catch (error) {
      setMessage(error.message);
    }
  };

  useEffect(() => {
    // Data reloads after authentication and search changes.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, productSearch, customerSearch]);

  const handleAuth = async (event) => {
    event.preventDefault();
    setMessage('');
    try {
      if (authMode === 'register') {
        await registerUser(authForm);
        setAuthMode('login');
        setAuthForm({ userId: authForm.userId, username: '', password: '' });
        setMessage('Registration successful. Please login with your credentials.');
        return;
      }

      const data = await loginUser({ userId: authForm.userId, password: authForm.password });
      localStorage.setItem('dabSession', JSON.stringify(data));
      localStorage.setItem('dabToken', data.token);
      setToken(data.token);
      setUser(data.user);
      setMessage(`Welcome ${data.user.username}`);
    } catch (error) {
      setMessage(error.message);
    }
  };

  const logout = () => {
    localStorage.removeItem('dabSession');
    localStorage.removeItem('dabToken');
    setToken('');
    setUser(null);
    setActiveTab('dashboard');
  };

  const saveProduct = async (event) => {
    event.preventDefault();
    const payload = { ...productForm, quantity: Number(productForm.quantity), unitPrice: Number(productForm.unitPrice) };
    try {
      if (editingProduct) {
        await request(`/products/${editingProduct}`, { method: 'PUT', body: JSON.stringify(payload) });
        setMessage('Product updated successfully');
      } else {
        await request('/products', { method: 'POST', body: JSON.stringify(payload) });
        setMessage('Product added successfully');
      }
      setProductForm(emptyProduct);
      setEditingProduct('');
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const saveCustomer = async (event) => {
    event.preventDefault();
    try {
      if (editingCustomer) {
        await request(`/customers/${editingCustomer}`, { method: 'PUT', body: JSON.stringify(customerForm) });
        setMessage('Customer updated successfully');
      } else {
        await request('/customers', { method: 'POST', body: JSON.stringify(customerForm) });
        setMessage('Customer registered successfully');
      }
      setCustomerForm(emptyCustomer);
      setEditingCustomer('');
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const createOrder = async (event) => {
    event.preventDefault();
    try {
      const items = orderForm.items.filter((item) => item.productId).map((item) => ({ ...item, quantity: Number(item.quantity) }));
      await request('/orders', { method: 'POST', body: JSON.stringify({ customerId: orderForm.customerId, items }) });
      setOrderForm({ customerId: '', items: [{ productId: '', quantity: 1 }] });
      setMessage('Order created and invoice generated');
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const recordPayment = async (event) => {
    event.preventDefault();
    try {
      await request('/payments', { method: 'POST', body: JSON.stringify({ ...paymentForm, amountPaid: Number(paymentForm.amountPaid) }) });
      setPaymentForm({ orderId: '', amountPaid: '', paymentMethod: 'Cash' });
      setMessage('Payment recorded successfully');
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const removeRecord = async (path, label) => {
    if (!confirm(`Delete this ${label}?`)) return;
    try {
      await request(path, { method: 'DELETE' });
      setMessage(`${label} deleted`);
      loadData();
    } catch (error) {
      setMessage(error.message);
    }
  };

  const orderTotal = orderForm.items.reduce((sum, item) => {
    const product = products.find((entry) => entry._id === item.productId);
    return sum + Number(item.quantity || 0) * Number(product?.unitPrice || 0);
  }, 0);

  const generateInvoice = (order) => {
    const rows = order.details?.map((detail) => `
      <tr>
        <td>${detail.productname}</td>
        <td>${detail.quantity}</td>
        <td>${money(detail.unitPrice)}</td>
        <td>${money(detail.subtotal)}</td>
      </tr>
    `).join('') || '';

    printDocument(
      `Invoice ${order._id}`,
      `
        <h1>DAB Enterprise</h1>
        <p class="muted">Customer order invoice</p>
        <h2>Invoice</h2>
        <p><strong>Invoice No:</strong> ${order._id}</p>
        <p><strong>Customer:</strong> ${order.customer?.firstname || ''} ${order.customer?.lastname || ''}</p>
        <p><strong>Date:</strong> ${date(order.orderDate)}</p>
        <table>
          <thead><tr><th>Product</th><th>Quantity</th><th>Unit Price</th><th>Subtotal</th></tr></thead>
          <tbody>${rows}</tbody>
        </table>
        <p class="total">Total: ${money(order.totalAmount)}</p>
      `,
    );
  };

  const generatePaymentReceipt = (payment) => {
    printDocument(
      `Payment Receipt ${payment._id}`,
      `
        <h1>DAB Enterprise</h1>
        <p class="muted">Payment receipt</p>
        <h2>Receipt</h2>
        <p><strong>Receipt No:</strong> ${payment._id}</p>
        <p><strong>Customer:</strong> ${payment.order?.customer?.firstname || ''} ${payment.order?.customer?.lastname || ''}</p>
        <p><strong>Order No:</strong> ${payment.order?._id || ''}</p>
        <p><strong>Payment Date:</strong> ${date(payment.paymentDate)}</p>
        <p><strong>Payment Method:</strong> ${payment.paymentMethod}</p>
        <p><strong>Order Total:</strong> ${money(payment.order?.totalAmount)}</p>
        <p class="total">Amount Paid: ${money(payment.amountPaid)}</p>
      `,
    );
  };

  if (!token) {
    return (
      <main className="flex min-h-screen items-center bg-[#edf2f8] px-4 py-6 text-slate-950 sm:py-10">
        <section className="mx-auto w-full max-w-[540px] rounded-2xl bg-white px-5 py-7 shadow-2xl shadow-slate-300/70 sm:rounded-[28px] sm:px-10 sm:py-10">
          <h1 className="mb-7 text-3xl font-bold tracking-normal sm:mb-9 sm:text-4xl">
            {authMode === 'register' ? 'Create Account' : 'Sign In'}
          </h1>

          <form onSubmit={handleAuth} className="space-y-5 sm:space-y-7">
            <label className="block">
              <span className="mb-2 block text-base">User ID</span>
              <input
                className="auth-input"
                value={authForm.userId}
                onChange={(event) => setAuthForm({ ...authForm, userId: event.target.value })}
                required
              />
            </label>

            {authMode === 'register' && (
              <label className="block">
                <span className="mb-2 block text-base">Username</span>
                <input
                  className="auth-input"
                  value={authForm.username}
                  onChange={(event) => setAuthForm({ ...authForm, username: event.target.value })}
                  required
                />
              </label>
            )}

            <label className="block">
              <span className="mb-2 block text-base">Password</span>
              <input
                type="password"
                className="auth-input"
                value={authForm.password}
                onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })}
                required
              />
              {authMode === 'register' && (
                <span className="mt-3 block max-w-[420px] text-sm leading-5 text-slate-500">
                  Use at least 8 characters, including uppercase, lowercase, numbers, and symbols for a stronger password.
                </span>
              )}
            </label>

            {message && <p className="rounded-md bg-slate-100 px-4 py-3 text-sm text-slate-700">{message}</p>}

            <button className="h-[50px] w-full rounded-xl bg-slate-800 text-base font-bold text-white hover:bg-slate-950 sm:h-[53px] sm:rounded-2xl">
              {authMode === 'register' ? 'Register' : 'Login'}
            </button>
          </form>

          <p className="mt-8 text-center text-base text-slate-600">
            {authMode === 'register' ? 'Already have an account?' : 'Need an account?'}{' '}
            <button
              className="font-bold text-slate-950"
              onClick={() => {
                setMessage('');
                setAuthMode(authMode === 'register' ? 'login' : 'register');
              }}
            >
              {authMode === 'register' ? 'Sign in' : 'Create account'}
            </button>
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="min-h-screen overflow-x-hidden bg-slate-100 text-slate-900">
      <aside className="fixed inset-y-0 left-0 hidden w-64 border-r border-slate-200 bg-white px-5 py-6 lg:block">
        <h1 className="text-2xl font-bold">DAB Enterprise</h1>
        <p className="mt-1 text-sm text-slate-500">Electronics management</p>
        <nav className="mt-8 space-y-2">
          {['dashboard', 'products', 'customers', 'orders', 'payments', 'reports'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`w-full rounded-lg px-4 py-3 text-left text-sm font-semibold capitalize ${
                activeTab === tab ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </aside>

      <section className="lg:pl-64">
        <header className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 px-4 py-4 backdrop-blur lg:px-8">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <p className="text-sm text-slate-500">Logged in as {user?.username}</p>
              <h2 className="text-2xl font-bold capitalize">{activeTab}</h2>
            </div>
            <div className="flex w-full flex-wrap gap-2 lg:w-auto">
              <select className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 lg:hidden" value={activeTab} onChange={(event) => setActiveTab(event.target.value)}>
                {['dashboard', 'products', 'customers', 'orders', 'payments', 'reports'].map((tab) => (
                  <option key={tab} value={tab}>{tab}</option>
                ))}
              </select>
              <button onClick={logout} className="rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                Logout
              </button>
            </div>
          </div>
          {message && <p className="mt-3 rounded-md bg-white px-3 py-2 text-sm text-slate-600 shadow-sm">{message}</p>}
        </header>

        <div className="px-3 py-5 sm:px-4 sm:py-6 lg:px-8">
          {activeTab === 'dashboard' && (
            <section className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat title="Products" value={reports?.summary.products || 0} />
                <Stat title="Customers" value={reports?.summary.customers || 0} />
                <Stat title="Orders" value={reports?.summary.orders || 0} />
                <Stat title="Sales" value={money(reports?.summary.totalSales)} />
              </div>
              <div className="grid gap-6 xl:grid-cols-2">
                <Panel title="Latest Orders">
                  <Table headers={['Customer', 'Date', 'Total']}>
                    {orders.slice(0, 6).map((order) => (
                      <tr key={order._id}>
                        <td>{order.customer?.firstname} {order.customer?.lastname}</td>
                        <td>{date(order.orderDate)}</td>
                        <td>{money(order.totalAmount)}</td>
                      </tr>
                    ))}
                  </Table>
                </Panel>
                <Panel title="Low Stock Products">
                  <Table headers={['Product', 'Category', 'Qty']}>
                    {products.filter((product) => product.quantity <= 5).map((product) => (
                      <tr key={product._id}>
                        <td>{product.productname}</td>
                        <td>{product.category}</td>
                        <td>{product.quantity}</td>
                      </tr>
                    ))}
                  </Table>
                </Panel>
              </div>
            </section>
          )}

          {activeTab === 'products' && (
            <section className="grid min-w-0 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <Panel title={editingProduct ? 'Update Product' : 'Add Product'}>
                <form onSubmit={saveProduct} className="space-y-4">
                  <Input label="Product name" value={productForm.productname} onChange={(value) => setProductForm({ ...productForm, productname: value })} />
                  <Input label="Category" value={productForm.category} onChange={(value) => setProductForm({ ...productForm, category: value })} />
                  <Input label="Quantity" type="number" value={productForm.quantity} onChange={(value) => setProductForm({ ...productForm, quantity: value })} />
                  <Input label="Unit price" type="number" value={productForm.unitPrice} onChange={(value) => setProductForm({ ...productForm, unitPrice: value })} />
                  <button className="primary-btn">{editingProduct ? 'Update Product' : 'Add Product'}</button>
                  {editingProduct && (
                    <button type="button" className="secondary-btn" onClick={() => { setEditingProduct(''); setProductForm(emptyProduct); }}>
                      Cancel Update
                    </button>
                  )}
                </form>
              </Panel>
              <Panel title="Display Product List">
                <Search value={productSearch} onChange={setProductSearch} placeholder="Search products..." />
                <Table headers={['Name', 'Category', 'Qty', 'Unit Price', 'Actions']}>
                  {products.map((product) => (
                    <tr key={product._id}>
                      <td>{product.productname}</td>
                      <td>{product.category}</td>
                      <td>{product.quantity}</td>
                      <td>{money(product.unitPrice)}</td>
                      <td><RowActions onEdit={() => { setEditingProduct(product._id); setProductForm(product); }} onDelete={() => removeRecord(`/products/${product._id}`, 'product')} /></td>
                    </tr>
                  ))}
                </Table>
              </Panel>
            </section>
          )}

          {activeTab === 'customers' && (
            <section className="grid min-w-0 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <Panel title={editingCustomer ? 'Edit Customer' : 'Register Customer'}>
                <form onSubmit={saveCustomer} className="space-y-4">
                  <Input label="First name" value={customerForm.firstname} onChange={(value) => setCustomerForm({ ...customerForm, firstname: value })} />
                  <Input label="Last name" value={customerForm.lastname} onChange={(value) => setCustomerForm({ ...customerForm, lastname: value })} />
                  <Input label="Telephone" value={customerForm.telephone} onChange={(value) => setCustomerForm({ ...customerForm, telephone: value })} />
                  <Input label="Address" value={customerForm.address} onChange={(value) => setCustomerForm({ ...customerForm, address: value })} />
                  <button className="primary-btn">{editingCustomer ? 'Update Customer' : 'Register Customer'}</button>
                  {editingCustomer && (
                    <button type="button" className="secondary-btn" onClick={() => { setEditingCustomer(''); setCustomerForm(emptyCustomer); }}>
                      Cancel Edit
                    </button>
                  )}
                </form>
              </Panel>
              <Panel title="View Customers">
                <Search value={customerSearch} onChange={setCustomerSearch} placeholder="Search customers..." />
                <Table headers={['Name', 'Telephone', 'Address', 'Actions']}>
                  {customers.map((customer) => (
                    <tr key={customer._id}>
                      <td>{customer.firstname} {customer.lastname}</td>
                      <td>{customer.telephone}</td>
                      <td>{customer.address}</td>
                      <td><RowActions onEdit={() => { setEditingCustomer(customer._id); setCustomerForm(customer); }} onDelete={() => removeRecord(`/customers/${customer._id}`, 'customer')} /></td>
                    </tr>
                  ))}
                </Table>
              </Panel>
            </section>
          )}

          {activeTab === 'orders' && (
            <section className="grid min-w-0 gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
              <Panel title="Create Customer Order">
                <form onSubmit={createOrder} className="space-y-4">
                  <Select label="Customer" value={orderForm.customerId} onChange={(value) => setOrderForm({ ...orderForm, customerId: value })} options={customers.map((customer) => ({ value: customer._id, label: `${customer.firstname} ${customer.lastname}` }))} />
                  {orderForm.items.map((item, index) => (
                    <div className="grid grid-cols-1 gap-2 sm:grid-cols-[minmax(0,1fr)_90px_40px]" key={index}>
                      <select className="field" value={item.productId} onChange={(event) => {
                        const items = [...orderForm.items];
                        items[index].productId = event.target.value;
                        setOrderForm({ ...orderForm, items });
                      }}>
                        <option value="">Select product</option>
                        {products.map((product) => <option key={product._id} value={product._id}>{product.productname} - {money(product.unitPrice)}</option>)}
                      </select>
                      <input className="field" type="number" min="1" value={item.quantity} onChange={(event) => {
                        const items = [...orderForm.items];
                        items[index].quantity = event.target.value;
                        setOrderForm({ ...orderForm, items });
                      }} />
                      <button type="button" className="min-h-11 rounded-md bg-slate-200 font-bold text-slate-700" onClick={() => setOrderForm({ ...orderForm, items: orderForm.items.filter((_, itemIndex) => itemIndex !== index) })}>x</button>
                    </div>
                  ))}
                  <button type="button" className="secondary-btn" onClick={() => setOrderForm({ ...orderForm, items: [...orderForm.items, { productId: '', quantity: 1 }] })}>Add Product</button>
                  <div className="rounded-lg bg-slate-100 p-4 font-bold">Total: {money(orderTotal)}</div>
                  <button className="primary-btn">Create Order</button>
                </form>
              </Panel>
              <Panel title="Generated Invoices / Receipts">
                <Table headers={['Customer', 'Products', 'Date', 'Total', 'Invoice']}>
                  {orders.map((order) => (
                    <tr key={order._id}>
                      <td>{order.customer?.firstname} {order.customer?.lastname}</td>
                      <td>{order.details?.map((detail) => `${detail.productname} x${detail.quantity}`).join(', ')}</td>
                      <td>{date(order.orderDate)}</td>
                      <td>{money(order.totalAmount)}</td>
                      <td><button className="table-btn" onClick={() => generateInvoice(order)}>Print Invoice</button></td>
                    </tr>
                  ))}
                </Table>
              </Panel>
            </section>
          )}

          {activeTab === 'payments' && (
            <section className="grid min-w-0 gap-6 xl:grid-cols-[360px_minmax(0,1fr)]">
              <Panel title="Record Payment">
                <form onSubmit={recordPayment} className="space-y-4">
                  <Select label="Order" value={paymentForm.orderId} onChange={(value) => setPaymentForm({ ...paymentForm, orderId: value })} options={orders.map((order) => ({ value: order._id, label: `${order.customer?.firstname || 'Customer'} - ${money(order.totalAmount)}` }))} />
                  <Input label="Amount paid" type="number" value={paymentForm.amountPaid} onChange={(value) => setPaymentForm({ ...paymentForm, amountPaid: value })} />
                  <Select label="Payment method" value={paymentForm.paymentMethod} onChange={(value) => setPaymentForm({ ...paymentForm, paymentMethod: value })} options={['Cash', 'Card', 'EFT', 'Mobile Money'].map((method) => ({ value: method, label: method }))} />
                  <button className="primary-btn">Save Payment</button>
                </form>
              </Panel>
              <Panel title="Payment History and Receipts">
                <Table headers={['Customer', 'Order Total', 'Paid', 'Method', 'Date', 'Receipt']}>
                  {payments.map((payment) => (
                    <tr key={payment._id}>
                      <td>{payment.order?.customer?.firstname} {payment.order?.customer?.lastname}</td>
                      <td>{money(payment.order?.totalAmount)}</td>
                      <td>{money(payment.amountPaid)}</td>
                      <td>{payment.paymentMethod}</td>
                      <td>{date(payment.paymentDate)}</td>
                      <td><button className="table-btn" onClick={() => generatePaymentReceipt(payment)}>Print Receipt</button></td>
                    </tr>
                  ))}
                </Table>
              </Panel>
            </section>
          )}

          {activeTab === 'reports' && (
            <section className="space-y-6">
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                <Stat title="Available Products" value={reports?.summary.products || 0} />
                <Stat title="Customer Orders" value={reports?.summary.orders || 0} />
                <Stat title="Payments" value={money(reports?.summary.totalPaid)} />
                <Stat title="Outstanding" value={money(reports?.summary.outstanding)} />
              </div>
              <Panel title="Sales Summary">
                <div className="mb-4 flex justify-end">
                  <button
                    className="table-btn"
                    onClick={() => printReport(
                      'Sales Summary',
                      ['Total Sales', 'Total Paid', 'Outstanding Balance', 'Customers'],
                      [[
                        money(reports?.summary.totalSales),
                        money(reports?.summary.totalPaid),
                        money(reports?.summary.outstanding),
                        reports?.summary.customers || 0,
                      ]],
                    )}
                  >
                    Print PDF
                  </button>
                </div>
                <Table headers={['Total Sales', 'Total Paid', 'Outstanding Balance', 'Customers']}>
                  <tr>
                    <td>{money(reports?.summary.totalSales)}</td>
                    <td>{money(reports?.summary.totalPaid)}</td>
                    <td>{money(reports?.summary.outstanding)}</td>
                    <td>{reports?.summary.customers || 0}</td>
                  </tr>
                </Table>
              </Panel>
              <Panel title="Available Products Report">
                <div className="mb-4 flex justify-end">
                  <button
                    className="table-btn"
                    onClick={() => printReport(
                      'Available Products',
                      ['Product', 'Category', 'Quantity', 'Unit Price'],
                      (reports?.availableProducts || []).map((product) => [
                        product.productname,
                        product.category,
                        product.quantity,
                        money(product.unitPrice),
                      ]),
                    )}
                  >
                    Print PDF
                  </button>
                </div>
                <Table headers={['Product', 'Category', 'Quantity', 'Unit Price']}>
                  {reports?.availableProducts.map((product) => (
                    <tr key={product._id}><td>{product.productname}</td><td>{product.category}</td><td>{product.quantity}</td><td>{money(product.unitPrice)}</td></tr>
                  ))}
                </Table>
              </Panel>
              <Panel title="Customer Orders Report">
                <div className="mb-4 flex justify-end">
                  <button
                    className="table-btn"
                    onClick={() => printReport(
                      'Customer Orders',
                      ['Customer', 'Date', 'Products', 'Total'],
                      orders.map((order) => [
                        `${order.customer?.firstname || ''} ${order.customer?.lastname || ''}`,
                        date(order.orderDate),
                        order.details?.map((detail) => `${detail.productname} x${detail.quantity}`).join(', '),
                        money(order.totalAmount),
                      ]),
                    )}
                  >
                    Print PDF
                  </button>
                </div>
                <Table headers={['Customer', 'Date', 'Products', 'Total']}>
                  {orders.map((order) => (
                    <tr key={order._id}>
                      <td>{order.customer?.firstname} {order.customer?.lastname}</td>
                      <td>{date(order.orderDate)}</td>
                      <td>{order.details?.map((detail) => `${detail.productname} x${detail.quantity}`).join(', ')}</td>
                      <td>{money(order.totalAmount)}</td>
                    </tr>
                  ))}
                </Table>
              </Panel>
              <Panel title="Payments Report">
                <div className="mb-4 flex justify-end">
                  <button
                    className="table-btn"
                    onClick={() => printReport(
                      'Payments',
                      ['Customer', 'Paid', 'Method', 'Date'],
                      payments.map((payment) => [
                        `${payment.order?.customer?.firstname || ''} ${payment.order?.customer?.lastname || ''}`,
                        money(payment.amountPaid),
                        payment.paymentMethod,
                        date(payment.paymentDate),
                      ]),
                    )}
                  >
                    Print PDF
                  </button>
                </div>
                <Table headers={['Customer', 'Paid', 'Method', 'Date']}>
                  {payments.map((payment) => (
                    <tr key={payment._id}>
                      <td>{payment.order?.customer?.firstname} {payment.order?.customer?.lastname}</td>
                      <td>{money(payment.amountPaid)}</td>
                      <td>{payment.paymentMethod}</td>
                      <td>{date(payment.paymentDate)}</td>
                    </tr>
                  ))}
                </Table>
              </Panel>
            </section>
          )}
        </div>
      </section>
    </main>
  );
}

function Panel({ title, children }) {
  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <h3 className="mb-4 text-lg font-bold">{title}</h3>
      {children}
    </section>
  );
}

function Stat({ title, value }) {
  return (
    <div className="min-w-0 rounded-lg border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
      <p className="text-sm font-semibold text-slate-500">{title}</p>
      <p className="mt-2 break-words text-2xl font-bold sm:text-3xl">{value}</p>
    </div>
  );
}

function Input({ label, value, onChange, type = 'text' }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-600">{label}</span>
      <input className="field" type={type} value={value || ''} onChange={(event) => onChange(event.target.value)} required />
    </label>
  );
}

function Select({ label, value, onChange, options }) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-semibold text-slate-600">{label}</span>
      <select className="field" value={value} onChange={(event) => onChange(event.target.value)} required>
        <option value="">Select {label.toLowerCase()}</option>
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    </label>
  );
}

function Search({ value, onChange, placeholder }) {
  return <input className="field mb-4" value={value} onChange={(event) => onChange(event.target.value)} placeholder={placeholder} />;
}

function Table({ headers, children }) {
  return (
    <div className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <table className="w-full min-w-[560px] text-left text-xs sm:min-w-[680px] sm:text-sm">
        <thead>
          <tr className="border-b border-slate-200 text-slate-500">
            {headers.map((header) => <th className="px-2 py-3 font-bold sm:px-3" key={header}>{header}</th>)}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100 [&_td]:px-2 [&_td]:py-3 sm:[&_td]:px-3">{children}</tbody>
      </table>
    </div>
  );
}

function RowActions({ onEdit, onDelete }) {
  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <button className="rounded-md bg-slate-100 px-3 py-1 font-semibold text-slate-700" onClick={onEdit}>Edit</button>
      <button className="rounded-md bg-red-50 px-3 py-1 font-semibold text-red-700" onClick={onDelete}>Delete</button>
    </div>
  );
}

export default App;
