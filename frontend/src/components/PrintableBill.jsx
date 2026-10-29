import React from 'react';

const PrintableBill = ({ order, restaurantName }) => {
    if (!order) return null;

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const calculateTotal = () => {
        const subtotal = order.total_amount || 0;
        const deliveryFee = order.delivery_fee || 0;
        const codFee = order.cod_fee || 0;
        return subtotal + deliveryFee + codFee;
    };

    return (
        <div className="print-bill-container">
            <style>
                {`
                    @media print {
                        body * {
                            visibility: hidden;
                        }
                        .print-bill-container, .print-bill-container * {
                            visibility: visible;
                        }
                        .print-bill-container {
                            position: absolute;
                            left: 0;
                            top: 0;
                            width: 80mm;
                            font-family: 'Courier New', monospace;
                        }
                        @page {
                            size: 80mm auto;
                            margin: 5mm;
                        }
                    }
                    
                    .print-bill-container {
                        width: 80mm;
                        padding: 10px;
                        font-family: 'Courier New', monospace;
                        font-size: 12px;
                        line-height: 1.4;
                        background: white;
                        color: black;
                    }
                    
                    .bill-header {
                        text-align: center;
                        border-bottom: 1px dashed #000;
                        padding-bottom: 10px;
                        margin-bottom: 10px;
                    }
                    
                    .bill-header h1 {
                        font-size: 18px;
                        font-weight: bold;
                        margin: 0;
                        text-transform: uppercase;
                    }
                    
                    .order-info {
                        margin-bottom: 10px;
                        border-bottom: 1px dashed #000;
                        padding-bottom: 10px;
                    }
                    
                    .order-info-row {
                        display: flex;
                        justify-content: space-between;
                        margin: 3px 0;
                    }
                    
                    .items-table {
                        width: 100%;
                        margin-bottom: 10px;
                        border-bottom: 1px dashed #000;
                        padding-bottom: 10px;
                    }
                    
                    .items-header {
                        display: flex;
                        justify-content: space-between;
                        font-weight: bold;
                        border-bottom: 1px solid #000;
                        padding-bottom: 5px;
                        margin-bottom: 5px;
                    }
                    
                    .item-row {
                        display: flex;
                        justify-content: space-between;
                        margin: 5px 0;
                    }
                    
                    .item-name {
                        flex: 2;
                        text-align: left;
                    }
                    
                    .item-qty {
                        flex: 0.5;
                        text-align: center;
                    }
                    
                    .item-price {
                        flex: 1;
                        text-align: right;
                    }
                    
                    .totals-section {
                        margin-top: 10px;
                    }
                    
                    .total-row {
                        display: flex;
                        justify-content: space-between;
                        margin: 3px 0;
                    }
                    
                    .grand-total {
                        font-weight: bold;
                        font-size: 14px;
                        border-top: 1px solid #000;
                        border-bottom: 1px double #000;
                        padding: 5px 0;
                        margin-top: 5px;
                    }
                    
                    .payment-info {
                        text-align: center;
                        margin-top: 10px;
                        padding-top: 10px;
                        border-top: 1px dashed #000;
                    }
                    
                    .footer {
                        text-align: center;
                        margin-top: 15px;
                        font-size: 10px;
                    }
                    
                    .no-print {
                        margin-top: 20px;
                        text-align: center;
                    }
                    
                    @media print {
                        .no-print {
                            display: none;
                        }
                    }
                `}
            </style>

            <div className="bill-header">
                <h1>{restaurantName || 'Restaurant'}</h1>
                <p>Order Bill</p>
            </div>

            <div className="order-info">
                <div className="order-info-row">
                    <span>Order ID:</span>
                    <span style={{ fontWeight: 'bold' }}>{order.id}</span>
                </div>
                <div className="order-info-row">
                    <span>Date:</span>
                    <span>{formatDate(order.created_at)}</span>
                </div>
                <div className="order-info-row">
                    <span>Customer:</span>
                    <span>{order.user_name}</span>
                </div>
                <div className="order-info-row">
                    <span>Phone:</span>
                    <span>{order.user_phone}</span>
                </div>
            </div>

            <div className="items-table">
                <div className="items-header">
                    <span className="item-name">Item</span>
                    <span className="item-qty">Qty</span>
                    <span className="item-price">Price</span>
                </div>
                {order.items?.map((item, index) => (
                    <div key={index} className="item-row">
                        <span className="item-name">{item.name}</span>
                        <span className="item-qty">{item.quantity}</span>
                        <span className="item-price">₹{(item.price * item.quantity).toFixed(0)}</span>
                    </div>
                ))}
            </div>

            <div className="totals-section">
                <div className="total-row">
                    <span>Subtotal:</span>
                    <span>₹{order.total_amount?.toFixed(0) || 0}</span>
                </div>
                {order.delivery_fee > 0 && (
                    <div className="total-row">
                        <span>Delivery Fee:</span>
                        <span>₹{order.delivery_fee?.toFixed(0)}</span>
                    </div>
                )}
                {order.cod_fee > 0 && (
                    <div className="total-row">
                        <span>COD Fee:</span>
                        <span>₹{order.cod_fee?.toFixed(0)}</span>
                    </div>
                )}
                <div className="total-row grand-total">
                    <span>GRAND TOTAL:</span>
                    <span>₹{calculateTotal().toFixed(0)}</span>
                </div>
            </div>

            <div className="payment-info">
                <strong>Payment: {order.payment_method === 'cod' ? 'Cash on Delivery' : 'Prepaid'}</strong>
                <br />
                <span>Status: {order.payment_status?.toUpperCase() || 'PENDING'}</span>
            </div>

            {order.notes && (
                <div style={{ marginTop: '10px', borderTop: '1px dashed #000', paddingTop: '10px' }}>
                    <strong>Notes:</strong>
                    <p>{order.notes}</p>
                </div>
            )}

            <div className="footer">
                <p>Thank you for your order!</p>
                <p>Powered by FoodKey</p>
            </div>

            <div className="no-print">
                <button
                    onClick={() => window.print()}
                    style={{
                        padding: '10px 20px',
                        backgroundColor: '#f97316',
                        color: 'white',
                        border: 'none',
                        borderRadius: '8px',
                        cursor: 'pointer',
                        fontSize: '14px',
                        fontWeight: 'bold'
                    }}
                >
                    Print Bill
                </button>
            </div>
        </div>
    );
};

export default PrintableBill;

// Helper function to open print window
export const openPrintBill = (order, restaurantName) => {
    const printWindow = window.open('', '_blank', 'width=350,height=600');
    
    if (!printWindow) {
        alert('Please allow popups to print bills');
        return;
    }

    const formatDate = (dateString) => {
        const date = new Date(dateString);
        return date.toLocaleString('en-IN', {
            day: '2-digit',
            month: '2-digit',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
            hour12: true
        });
    };

    const subtotal = order.total_amount || 0;
    const deliveryFee = order.delivery_fee || 0;
    const codFee = order.cod_fee || 0;
    const grandTotal = subtotal + deliveryFee + codFee;

    const itemsHtml = order.items?.map(item => `
        <div class="item-row">
            <span class="item-name">${item.name}</span>
            <span class="item-qty">${item.quantity}</span>
            <span class="item-price">₹${(item.price * item.quantity).toFixed(0)}</span>
        </div>
    `).join('') || '';

    const html = `
        <!DOCTYPE html>
        <html>
        <head>
            <title>Order Bill - ${order.id}</title>
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }
                body {
                    font-family: 'Courier New', monospace;
                    font-size: 12px;
                    line-height: 1.4;
                    background: white;
                    color: black;
                    padding: 10px;
                    width: 80mm;
                }
                .bill-header {
                    text-align: center;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 10px;
                    margin-bottom: 10px;
                }
                .bill-header h1 {
                    font-size: 18px;
                    font-weight: bold;
                    text-transform: uppercase;
                }
                .order-info {
                    margin-bottom: 10px;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 10px;
                }
                .order-info-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 3px 0;
                }
                .items-table {
                    width: 100%;
                    margin-bottom: 10px;
                    border-bottom: 1px dashed #000;
                    padding-bottom: 10px;
                }
                .items-header {
                    display: flex;
                    justify-content: space-between;
                    font-weight: bold;
                    border-bottom: 1px solid #000;
                    padding-bottom: 5px;
                    margin-bottom: 5px;
                }
                .item-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 5px 0;
                }
                .item-name { flex: 2; text-align: left; }
                .item-qty { flex: 0.5; text-align: center; }
                .item-price { flex: 1; text-align: right; }
                .totals-section { margin-top: 10px; }
                .total-row {
                    display: flex;
                    justify-content: space-between;
                    margin: 3px 0;
                }
                .grand-total {
                    font-weight: bold;
                    font-size: 14px;
                    border-top: 1px solid #000;
                    border-bottom: 1px double #000;
                    padding: 5px 0;
                    margin-top: 5px;
                }
                .payment-info {
                    text-align: center;
                    margin-top: 10px;
                    padding-top: 10px;
                    border-top: 1px dashed #000;
                }
                .footer {
                    text-align: center;
                    margin-top: 15px;
                    font-size: 10px;
                }
                .print-btn {
                    display: block;
                    width: 100%;
                    padding: 10px;
                    margin-top: 20px;
                    background: #f97316;
                    color: white;
                    border: none;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 14px;
                    font-weight: bold;
                }
                @media print {
                    .print-btn { display: none; }
                    body { width: 80mm; }
                    @page { size: 80mm auto; margin: 5mm; }
                }
            </style>
        </head>
        <body>
            <div class="bill-header">
                <h1>${restaurantName || 'Restaurant'}</h1>
                <p>Order Bill</p>
            </div>

            <div class="order-info">
                <div class="order-info-row">
                    <span>Order ID:</span>
                    <span style="font-weight: bold;">${order.id}</span>
                </div>
                <div class="order-info-row">
                    <span>Date:</span>
                    <span>${formatDate(order.created_at)}</span>
                </div>
                <div class="order-info-row">
                    <span>Customer:</span>
                    <span>${order.user_name}</span>
                </div>
                <div class="order-info-row">
                    <span>Phone:</span>
                    <span>${order.user_phone}</span>
                </div>
            </div>

            <div class="items-table">
                <div class="items-header">
                    <span class="item-name">Item</span>
                    <span class="item-qty">Qty</span>
                    <span class="item-price">Price</span>
                </div>
                ${itemsHtml}
            </div>

            <div class="totals-section">
                <div class="total-row">
                    <span>Subtotal:</span>
                    <span>₹${subtotal.toFixed(0)}</span>
                </div>
                ${deliveryFee > 0 ? `
                <div class="total-row">
                    <span>Delivery Fee:</span>
                    <span>₹${deliveryFee.toFixed(0)}</span>
                </div>
                ` : ''}
                ${codFee > 0 ? `
                <div class="total-row">
                    <span>COD Fee:</span>
                    <span>₹${codFee.toFixed(0)}</span>
                </div>
                ` : ''}
                <div class="total-row grand-total">
                    <span>GRAND TOTAL:</span>
                    <span>₹${grandTotal.toFixed(0)}</span>
                </div>
            </div>

            <div class="payment-info">
                <strong>Payment: ${order.payment_method === 'cod' ? 'Cash on Delivery' : 'Prepaid'}</strong>
                <br />
                <span>Status: ${(order.payment_status || 'pending').toUpperCase()}</span>
            </div>

            ${order.notes ? `
            <div style="margin-top: 10px; border-top: 1px dashed #000; padding-top: 10px;">
                <strong>Notes:</strong>
                <p>${order.notes}</p>
            </div>
            ` : ''}

            <div class="footer">
                <p>Thank you for your order!</p>
                <p>Powered by FoodKey</p>
            </div>

            <button class="print-btn" onclick="window.print()">Print Bill</button>
        </body>
        </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
};
