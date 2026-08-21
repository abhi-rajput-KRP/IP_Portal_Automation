import { initializeApp } from "firebase/app";
import { signInWithEmailAndPassword, getAuth, signOut, onAuthStateChanged } from "firebase/auth";
import { getFirestore, collection, query, where, getDocs, doc,updateDoc } from "firebase/firestore";

const firebaseConfig = {
    apiKey: import.meta.env.VITE_apiKey,
    authDomain: import.meta.env.VITE_authDomain,
    projectId: import.meta.env.VITE_projectId,
    storageBucket: import.meta.env.VITE_storageBucket,
    messagingSenderId: import.meta.env.VITE_messagingSenderId,
    appId: import.meta.env.VITE_appId,
    measurementId: import.meta.env.VITE_measurementId
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

export async function loginUser(email, password) {
    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        console.log("Logged in successfully");
        return user;
    } catch (error) {
        console.error("Login failed:", error.code, error.message);
        throw error;
    }
}

export function checklogin() {
    return new Promise((resolve) => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      unsubscribe(); // Unsubscribe immediately after the first check
      resolve(Boolean(user));
    });
  });
}

export async function logout() {
    await signOut(auth);
}

export async function getItems(sem) {
    const q = query(
        collection(db, "Students"),
        where('sem','==',sem)
    );

    const querySnapshot = await getDocs(q);
    const items = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
    }));
    items.sort((a,b)=>Number(a['enrollment_no'].slice(0,3)) - Number(b['enrollment_no'].slice(0,2)));
    return items;
}

export async function updateStudentMarks(id, marks) {
  try {
    const studentRef = doc(db, "Students", id);
    await updateDoc(studentRef, {
      marks: Number(marks)
    });
  } catch (error) {
    console.error("Error updating marks:", error);
  }
}