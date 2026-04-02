// src/firebase.js
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// 아래 객체 내용을 본인이 발급받은 firebaseConfig 정보로 덮어쓰세요!
const firebaseConfig = {
  apiKey: "AIzaSyAXDbHU5ERSG4UpmYkGj2XYZyFRfyPMMVc",
  authDomain: "my-workspace-links-62bf8.firebaseapp.com",
  projectId: "my-workspace-links-62bf8",
  storageBucket: "my-workspace-links-62bf8.firebasestorage.app",
  messagingSenderId: "626652391702",
  appId: "1:626652391702:web:f426415768af226b768837",
  measurementId: "G-N5N836PGCJ"
};

// Firebase 초기화
const app = initializeApp(firebaseConfig);

// 로그인 인증(Auth)과 데이터베이스(Firestore)를 다른 파일에서 쓸 수 있도록 내보내기
export const auth = getAuth(app);
export const db = getFirestore(app);