const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");

setGlobalOptions({ region: "asia-south1", maxInstances: 1 });
initializeApp();

const ADMIN_UID = "AInbtkxwW0UVMWdh12HCWNcDn1l2";
const WIPE_CONFIRMATION = "WIPE EVERYTHING";

exports.wipeTestEnvironment = onCall(async (request) => {
  if (!request.auth || request.auth.uid !== ADMIN_UID) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  if (request.data?.confirmation !== WIPE_CONFIRMATION) {
    throw new HttpsError("failed-precondition", "Explicit wipe confirmation required.");
  }

  const db = getFirestore();
  const auth = getAuth();

  const collections = await db.listCollections();
  for (const collection of collections) {
    await db.recursiveDelete(collection);
  }

  let page = await auth.listUsers(1000);
  while (page.users.length) {
    await auth.deleteUsers(page.users.map((user) => user.uid));
    if (!page.pageToken) break;
    page = await auth.listUsers(1000, page.pageToken);
  }

  return {
    ok: true,
    firestoreCollectionsDeleted: collections.length,
    authUsersDeleted: true
  };
});
