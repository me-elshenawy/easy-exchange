// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyB2QJbErF21fQaaFeCwM6NW6wUbEJwvrnw",
  authDomain: "email-verification-demo-ad22c.firebaseapp.com",
  projectId: "email-verification-demo-ad22c",
  storageBucket: "email-verification-demo-ad22c.firebasestorage.app",
  messagingSenderId: "247268148789",
  appId: "1:247268148789:web:e9d343da7caaad9926137c",
  measurementId: "G-PB6FH83GR3"
}; 

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const db = firebase.firestore();