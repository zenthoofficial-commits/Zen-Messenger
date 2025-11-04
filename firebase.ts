// Import the functions you need from the SDKs you need
// FIX: Use firebase v9 compat imports for v8 syntax. This resolves errors with firebase initialization and service access.
import firebase from "firebase/compat/app";
import "firebase/compat/database";
import "firebase/compat/auth";
import "firebase/compat/storage";

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyDk7aHKFSLSz84e8i2Oub1RMw0Mm3GNm8Q",
  authDomain: "studio-52jc2.firebaseapp.com",
  databaseURL: "https://studio-52jc2-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "studio-52jc2",
  storageBucket: "studio-52jc2.appspot.com",
  messagingSenderId: "155578713128",
  appId: "1:155578713128:web:40e46f3d172db098c0211d"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}

const app = firebase.app();
const db = firebase.database();
const auth = firebase.auth();
const storage = firebase.storage();

export { app, db, auth, storage };