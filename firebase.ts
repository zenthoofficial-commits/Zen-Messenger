// Import the functions you need from the SDKs you need
// Fix: Use Firebase v8 namespaced imports.
// FIX: Use firebase v9 compat imports for v8 syntax. This resolves errors with firebase initialization and service access.
import firebase from "firebase/compat/app";
import "firebase/compat/firestore";
import "firebase/compat/analytics";
import "firebase/compat/auth";
import "firebase/compat/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyCiAC0zlmzh_7ygQtQp00rrWzqBfigpvwM",
  authDomain: "zen-f2949.firebaseapp.com",
  projectId: "zen-f2949",
  storageBucket: "zen-f2949.appspot.com",
  messagingSenderId: "680128152531",
  appId: "1:680128152531:web:358880f07de5cdd0fa6526",
  measurementId: "G-9Y5D04TZSP"
};

// Initialize Firebase
// Fix: Use v8 initialization pattern.
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const app = firebase.app();
const db = firebase.firestore();
const analytics = firebase.analytics();
const auth = firebase.auth();
const storage = firebase.storage();

export { app, db, analytics, auth, storage };