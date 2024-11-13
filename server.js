import express from "express";
import "dotenv/config";
import {
    ApiError,
    CheckoutPaymentIntent,
    Client,
    Environment,
    LogLevel,
    OrdersController,
    PaymentsController,
} from "@paypal/paypal-server-sdk";
import bodyParser from "body-parser";
import cors from 'cors';  // Use ES Module import syntax



const app = express();
app.use(bodyParser.json());
// Allow cross-origin requests from your React app
app.use(cors({
    origin: 'https://gearhub.vercel.app',  // Allows requests only from 'https://gearhub.vercel.app'
}));

const PAYPAL_CLIENT_ID = "AZ1uE3g27QxPPuSWGmKuBj6NQ1Er_mSjztaw8y12ZF7YtR4F1qgNKY2ERfLdufWKp6O-OPuxJcRrVInC";
const PAYPAL_CLIENT_SECRET = "EB-sbyMcAAqr4X1Fu3xp0mQ9sZvg4eZuEFMfwfbtw5LEO8Xhm_5aHpIsnPIEqJwgDwUSpzKA6NtA7v7T";
const PORT = 8080; // Use default or hardcode as needed

const client = new Client({
    clientCredentialsAuthCredentials: {
        oAuthClientId: PAYPAL_CLIENT_ID,
        oAuthClientSecret: PAYPAL_CLIENT_SECRET,
    },
    timeout: 0,
    environment: Environment.Live,
    logging: {
        logLevel: LogLevel.Info,
        logRequest: { logBody: true },
        logResponse: { logHeaders: true },
    },
});

const ordersController = new OrdersController(client);
const paymentsController = new PaymentsController(client);

/**
 * Create an order to start the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_create
 */
const createOrder = async (cart) => {
    const collect = {
        body: {
            intent: "CAPTURE",
            purchaseUnits: [
                {
                    amount: {
                        currencyCode: "CAD",
                        value: "10",
                    },
                },
            ],
        },
        prefer: "return=minimal",
    }; 

    try {
        const { body, ...httpResponse } = await ordersController.ordersCreate(
            collect
        );
        // Get more response info...
        // const { statusCode, headers } = httpResponse;
        return {
            jsonResponse: JSON.parse(body),
            httpStatusCode: httpResponse.statusCode,
        };
    } catch (error) {
        console.error("Error creating order:", error);
        if (error instanceof ApiError && error.response) {
            console.error("Detailed PayPal API response:", error.response);
        }
        throw error;
    }
};

// createOrder route
app.post("/api/orders", async (req, res) => {
    try {
        // use the cart information passed from the front-end to calculate the order amount detals
        const { cart } = req.body;
        const { jsonResponse, httpStatusCode } = await createOrder(cart);
        res.status(httpStatusCode).json(jsonResponse);
    } catch (error) {
        console.error("Failed to create order:", error);
        if (error instanceof ApiError && error.response) {
            console.error("Detailed PayPal API response:", error.response);
        }
        res.status(500).json({ error: "Failed to capture order.", details: error.message || error.toString() });
    }
});



/**
 * Capture payment for the created order to complete the transaction.
 * @see https://developer.paypal.com/docs/api/orders/v2/#orders_capture
 */
const captureOrder = async (orderID) => {
    const collect = {
        id: orderID,
        prefer: "return=minimal",
    };

    try {
        const { body, ...httpResponse } = await ordersController.ordersCapture(
            collect
        );
        // Get more response info...
        // const { statusCode, headers } = httpResponse;
        return {
            jsonResponse: JSON.parse(body),
            httpStatusCode: httpResponse.statusCode,
        };
    } catch (error) {
        if (error instanceof ApiError) {
            // const { statusCode, headers } = error;
            throw new Error(error.message);
        }
    }
};

// captureOrder route
app.post("/api/orders/:orderID/capture", async (req, res) => {
    try {
        const { orderID } = req.params;
        const { jsonResponse, httpStatusCode } = await captureOrder(orderID);
        res.status(httpStatusCode).json(jsonResponse);
    } catch (error) {
        console.error("Failed to create order:", error);
        if (error instanceof ApiError && error.response) {
            console.error("Detailed PayPal API response:", error.response);
        }
        res.status(500).json({ error: "Failed to capture order.", details: error.message || error.toString() });
    }
});


app.listen(PORT, () => {
    console.log(`Node server listening at http://localhost:${PORT}/`);
}); 