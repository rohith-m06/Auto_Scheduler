# 📅 Amity University AutoScheduler

An intelligent, constraint-satisfaction timetable generator built for Amity University students. Upload your course data, set your professor/slot preferences, and generate conflict-free timetables automatically without head-scratching manual overlaps.

---

## 🚀 Live App

👉 https://autoschedulers.vercel.app/

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-blue.svg">
  <img src="https://img.shields.io/badge/version-1.0.0-green.svg">
  <img src="https://img.shields.io/badge/platform-Web-orange.svg">
</p>

---

## 🧠 Why I Built This

At Amity University, course selection and tracking open slots alongside preferred professors can feel like solving a massive puzzle. Mapping multiple combinations manually without overlapping slots is frustrating and time-consuming.

**AutoScheduler** automates this entire process — helping you generate clean, clash-free schedules instantly.

> ⚠️ **Note:** This is an independent personal project built for individual utility and experimentation. It is not affiliated with or officially supported by Amity University.

---

## ✨ Features

* 📊 **Smart Excel & Data Import**
  Upload `.xlsx`, PDF files, or paste raw text. The system automatically parses and structures your course data.

* 🤖 **AI-Powered Parsing**
  Uses Gemini AI to extract course codes, slots, and timings from unstructured input.

* ⚙️ **Fine-Grained Preferences**
  Choose preferred professors for theory and lab sessions.

* 📅 **Conflict-Free Engine**
  Generates up to 50 valid, clash-free timetable combinations.

* ⭐ **Favorites System**
  Save and compare your best schedule options.

* 💬 **AI Timetable Insights**
  Ask questions like:

  * “Which schedule has the least workload?”
  * “Where are my longest breaks?”

* 📥 **Clean Export**
  Download your timetable as an interactive HTML file.

* 🔐 **Cloud Sync**
  Firebase Authentication + Firestore ensures your schedules are saved and accessible anywhere.

---

## 🛠️ Tech Stack

* **Frontend:** React 19 + TypeScript + Vite
* **Styling:** TailwindCSS
* **AI Engine:** Google Gemini 2.5 Flash
* **Backend & Database:** Firebase (Auth + Firestore)
* **File Parsing:** PDF.js + XLSX

---

## 🚀 Getting Started

### ✅ Prerequisites

* Node.js (v18 or higher)
* Firebase project (Auth + Firestore enabled)
* Gemini API Key → https://aistudio.google.com/app/apikey

---

### ⚙️ Installation

```bash
# Clone the repo
git clone https://github.com/rohith-m06/auto-scheduler.git

# Move into project folder
cd auto-scheduler

# Install dependencies
npm install
```

---

### 🔑 Environment Setup

Create a `.env.local` file in the root directory:

```env
VITE_GEMINI_API_KEY=your_gemini_api_key
```

Also update your Firebase config inside:

```
src/services/firebase.ts
```

---

### ▶️ Run the App

```bash
npm run dev
```

Open in browser:

```
http://localhost:5173
```

---

## 📖 How To Use

1. 🔐 **Login / Sign Up**
   Secure your account to store schedules.

2. 📂 **Upload Data**
   Upload Excel/PDF or paste course details.

3. 🎯 **Select Courses**
   Choose subjects for your semester.

4. ⚙️ **Set Preferences**
   Pick professors and preferred timings.

5. 🚀 **Generate Schedule**
   Let the engine create clash-free timetables.

6. ⭐ **Compare & Save**
   Bookmark your best options.

7. 📥 **Export**
   Download your final timetable.

---

## 📄 License

This project is licensed under the **MIT License**.

---

## 💡 Future Improvements (Optional Section)

* Mobile responsive optimization
* Dark mode UI enhancements
* Calendar sync (Google Calendar integration)
* More advanced AI recommendations

---

## 🤝 Contributing

Contributions are welcome! Feel free to fork the repo and submit a pull request.

---

## 👨‍💻 Author

**Rohith M**
GitHub: https://github.com/rohith-m06

---

## ⭐ Support

If you found this useful, consider giving the repo a ⭐ on GitHub!
