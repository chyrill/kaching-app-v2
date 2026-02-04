// Email template utilities

const emailStyles = `
  <style>
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif;
      line-height: 1.6;
      color: #333;
      margin: 0;
      padding: 0;
      background-color: #f4f4f4;
    }
    .container {
      max-width: 600px;
      margin: 20px auto;
      background-color: #ffffff;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .header {
      background: linear-gradient(135deg, #10b981 0%, #059669 100%);
      color: white;
      padding: 30px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 700;
    }
    .content {
      padding: 30px;
    }
    .content h2 {
      color: #1f2937;
      margin-top: 0;
      font-size: 22px;
    }
    .button {
      display: inline-block;
      padding: 12px 24px;
      background-color: #10b981;
      color: white !important;
      text-decoration: none;
      border-radius: 6px;
      font-weight: 600;
      margin: 20px 0;
    }
    .button:hover {
      background-color: #059669;
    }
    .info-box {
      background-color: #f3f4f6;
      border-left: 4px solid #10b981;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .info-row {
      display: flex;
      justify-content: space-between;
      padding: 8px 0;
      border-bottom: 1px solid #e5e7eb;
    }
    .info-row:last-child {
      border-bottom: none;
    }
    .label {
      font-weight: 600;
      color: #6b7280;
    }
    .value {
      color: #1f2937;
    }
    .badge {
      display: inline-block;
      padding: 4px 12px;
      border-radius: 12px;
      font-size: 12px;
      font-weight: 600;
      text-transform: uppercase;
    }
    .badge-shopee {
      background-color: #ff6b35;
      color: white;
    }
    .badge-lazada {
      background-color: #0f1689;
      color: white;
    }
    .badge-tiktok {
      background-color: #000000;
      color: white;
    }
    .footer {
      background-color: #f9fafb;
      padding: 20px;
      text-align: center;
      color: #6b7280;
      font-size: 14px;
      border-top: 1px solid #e5e7eb;
    }
    .footer a {
      color: #10b981;
      text-decoration: none;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 20px 0;
    }
    th {
      background-color: #f3f4f6;
      padding: 12px;
      text-align: left;
      font-weight: 600;
      color: #6b7280;
      border-bottom: 2px solid #e5e7eb;
    }
    td {
      padding: 12px;
      border-bottom: 1px solid #e5e7eb;
    }
  </style>
`;

interface NewOrderEmailData {
  shopName: string;
  orderNumber: string;
  platform: string;
  customerName: string;
  totalAmount: number;
  itemCount: number;
  orderDetailsUrl: string;
}

export function generateNewOrderEmail(data: NewOrderEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${emailStyles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>🎉 New Order Received!</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.shopName}!</h2>
            <p>Great news! You have a new order from <strong>${data.platform}</strong>.</p>
            
            <div class="info-box">
              <div class="info-row">
                <span class="label">Order Number:</span>
                <span class="value"><strong>${data.orderNumber}</strong></span>
              </div>
              <div class="info-row">
                <span class="label">Platform:</span>
                <span class="value"><span class="badge badge-${data.platform.toLowerCase()}">${data.platform}</span></span>
              </div>
              <div class="info-row">
                <span class="label">Customer:</span>
                <span class="value">${data.customerName}</span>
              </div>
              <div class="info-row">
                <span class="label">Items:</span>
                <span class="value">${data.itemCount} item${data.itemCount !== 1 ? 's' : ''}</span>
              </div>
              <div class="info-row">
                <span class="label">Total Amount:</span>
                <span class="value"><strong>₱${data.totalAmount.toFixed(2)}</strong></span>
              </div>
            </div>
            
            <p>Process this order quickly to ensure customer satisfaction!</p>
            
            <center>
              <a href="${data.orderDetailsUrl}" class="button">View Order Details →</a>
            </center>
          </div>
          <div class="footer">
            <p>This is an automated notification from Kaching.</p>
            <p>Manage your notification preferences in <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications">Settings</a></p>
          </div>
        </div>
      </body>
    </html>
  `;
}

interface OrderStatusEmailData {
  shopName: string;
  orderNumber: string;
  platform: string;
  oldStatus: string;
  newStatus: string;
  customerName: string;
  trackingNumber?: string;
  carrier?: string;
  orderDetailsUrl: string;
}

export function generateOrderStatusEmail(data: OrderStatusEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${emailStyles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>📦 Order Status Updated</h1>
          </div>
          <div class="content">
            <h2>Order #${data.orderNumber}</h2>
            <p>The status of your order has been updated.</p>
            
            <div class="info-box">
              <div class="info-row">
                <span class="label">Previous Status:</span>
                <span class="value">${data.oldStatus}</span>
              </div>
              <div class="info-row">
                <span class="label">New Status:</span>
                <span class="value"><strong>${data.newStatus}</strong></span>
              </div>
              <div class="info-row">
                <span class="label">Platform:</span>
                <span class="value"><span class="badge badge-${data.platform.toLowerCase()}">${data.platform}</span></span>
              </div>
              <div class="info-row">
                <span class="label">Customer:</span>
                <span class="value">${data.customerName}</span>
              </div>
              ${data.trackingNumber ? `
              <div class="info-row">
                <span class="label">Tracking Number:</span>
                <span class="value"><strong>${data.trackingNumber}</strong></span>
              </div>
              ` : ''}
              ${data.carrier ? `
              <div class="info-row">
                <span class="label">Carrier:</span>
                <span class="value">${data.carrier}</span>
              </div>
              ` : ''}
            </div>
            
            <center>
              <a href="${data.orderDetailsUrl}" class="button">View Order Details →</a>
            </center>
          </div>
          <div class="footer">
            <p>This is an automated notification from Kaching.</p>
            <p>Manage your notification preferences in <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications">Settings</a></p>
          </div>
        </div>
      </body>
    </html>
  `;
}

interface LowStockProduct {
  name: string;
  sku: string;
  currentStock: number;
  threshold: number;
  platform: string;
}

interface LowStockEmailData {
  shopName: string;
  products: LowStockProduct[];
  inventoryUrl: string;
}

export function generateLowStockEmail(data: LowStockEmailData): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        ${emailStyles}
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>⚠️ Low Stock Alert</h1>
          </div>
          <div class="content">
            <h2>Hello ${data.shopName}!</h2>
            <p><strong>${data.products.length}</strong> product${data.products.length !== 1 ? 's are' : ' is'} running low on stock and need${data.products.length === 1 ? 's' : ''} your attention.</p>
            
            <table>
              <thead>
                <tr>
                  <th>Product</th>
                  <th>Platform</th>
                  <th>Current Stock</th>
                  <th>Threshold</th>
                </tr>
              </thead>
              <tbody>
                ${data.products.map(p => `
                  <tr>
                    <td>
                      <strong>${p.name}</strong><br>
                      <small style="color: #6b7280;">SKU: ${p.sku}</small>
                    </td>
                    <td><span class="badge badge-${p.platform.toLowerCase()}">${p.platform}</span></td>
                    <td><strong style="color: #ef4444;">${p.currentStock}</strong></td>
                    <td>${p.threshold}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
            
            <p>Consider restocking these items to avoid stockouts and missed sales opportunities.</p>
            
            <center>
              <a href="${data.inventoryUrl}" class="button">Manage Inventory →</a>
            </center>
          </div>
          <div class="footer">
            <p>This is an automated notification from Kaching.</p>
            <p>Manage your notification preferences in <a href="${process.env.NEXT_PUBLIC_APP_URL}/settings/notifications">Settings</a></p>
          </div>
        </div>
      </body>
    </html>
  `;
}
