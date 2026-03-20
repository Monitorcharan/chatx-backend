const admin = require('firebase-admin');
const path = require('path');
const fs = require('fs');

// Initialize Firebase Admin
let initialized = false;

// 1. Try environment variable (best for production/Render)
if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
  try {
    const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccount)
    });
    console.log('Firebase Admin initialized from environment variable');
    initialized = true;
  } catch (err) {
    console.error('Error parsing FIREBASE_SERVICE_ACCOUNT_JSON:', err.message);
  }
}

// 2. Fallback to local file (mainly for local development)
if (!initialized) {
  const serviceAccountPath = path.join(__dirname, '../config/serviceAccountKey.json');
  if (fs.existsSync(serviceAccountPath)) {
    admin.initializeApp({
      credential: admin.credential.cert(serviceAccountPath)
    });
    console.log('Firebase Admin initialized from serviceAccountKey.json');
    initialized = true;
  } else {
    console.warn('Firebase serviceAccountKey.json not found and no environment variable set. Push notifications will be disabled.');
  }
}

const sendNotification = async (token, payload) => {
  if (!admin.apps.length) return;

  try {
    const message = {
      token: token,
      notification: {
        title: payload.title,
        body: payload.body,
      },
      data: payload.data || {},
      android: {
        priority: 'high',
        notification: {
          sound: 'default',
          channelId: 'chat_messages',
        },
      },
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
    return response;
  } catch (error) {
    console.error('Error sending message:', error);
  }
};

module.exports = { sendNotification };
