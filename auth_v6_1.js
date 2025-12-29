const DB_NAME = 'DigiLearnDB';
const DB_VERSION = 6.1;
let db;

// --------------------
// Initialize DB
// --------------------
async function initDB() {
  if (db) return db;

  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onerror = (e) => reject(`DB error: ${e.target.errorCode}`);

    request.onupgradeneeded = (e) => {
      db = e.target.result;

      // Users store
      let usersStore;
      if (!db.objectStoreNames.contains('users')) {
        usersStore = db.createObjectStore('users', { keyPath: 'username' });
      } else {
        usersStore = e.target.transaction.objectStore('users');
      }
      if (!usersStore.indexNames.contains('email')) {
        usersStore.createIndex('email', 'email', { unique: true });
      }

      // Settings store
      if (!db.objectStoreNames.contains('settings')) {
        db.createObjectStore('settings', { keyPath: 'key' });
      }

      // Progress store
      let progressStore;
      if (!db.objectStoreNames.contains('progress')) {
        progressStore = db.createObjectStore('progress', { keyPath: 'id', autoIncrement: true });
      } else {
        progressStore = e.target.transaction.objectStore('progress');
      }
      if (!progressStore.indexNames.contains('userCourse')) {
        progressStore.createIndex('userCourse', ['username','courseId','lessonId'], { unique:true });
      }
    };

    request.onsuccess = (e) => {
      db = e.target.result;
      resolve(db);
    };
  });
}

// --------------------
// Users
// --------------------
async function getUser(usernameOrEmail) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readonly');
    const store = tx.objectStore('users');

    const request = store.get(usernameOrEmail);
    request.onsuccess = () => {
      if (request.result) return resolve(request.result);

      // fallback by email
      let emailIndex;
      try { emailIndex = store.index('email'); } catch { return resolve(null); }

      const emailRequest = emailIndex.get(usernameOrEmail);
      emailRequest.onsuccess = () => resolve(emailRequest.result || null);
      emailRequest.onerror = () => reject(emailRequest.error);
    };
    request.onerror = () => reject(request.error);
  });
}

async function signupUser(username, email, password, securityQA = [], otherData = null) {
  await initDB();

  return new Promise(async (resolve, reject) => {
    try {
      const existing = await getUser(username);
      if (existing) return resolve({ success: false, message: 'Username already exists' });

      const tx = db.transaction('users', 'readwrite');
      const store = tx.objectStore('users');

      const user = {
        username,
        email: email || null,
        password,
        securityQ1: securityQA[0]?.question || '',
        securityA1: securityQA[0]?.answer || '',
        securityQ2: securityQA[1]?.question || '',
        securityA2: securityQA[1]?.answer || '',
        createdAt: new Date().toISOString(),
        otherData
      };

      const req = store.add(user);
      req.onsuccess = () => resolve({ success: true, message: 'User created successfully' });
      req.onerror = () => resolve({ success: false, message: 'Failed to create user' });
    } catch (err) {
      reject(err);
    }
  });
}

// --------------------
// Update user function (NEW)
// --------------------
async function updateUser(user) {
  await initDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction('users', 'readwrite');
    const store = tx.objectStore('users');
    const req = store.put(user);
    req.onsuccess = () => resolve(true);
    req.onerror = () => reject(req.error);
  });
}

// --------------------
// Exports
// --------------------
export const userExists = async (username) => !!(await getUser(username));
export const createUser = async (data) => {
  return signupUser(
    data.username,
    data.email,
    data.password,
    [
      { question: data.q1, answer: data.a1 },
      { question: data.q2, answer: data.a2 }
    ],
    null
  );
};
export { getUser, signupUser, updateUser }; // <- export added
export { initDB };  // <-- add this