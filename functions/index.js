const { onCall, HttpsError } = require("firebase-functions/v2/https");
const { setGlobalOptions } = require("firebase-functions/v2");
const { initializeApp } = require("firebase-admin/app");
const { getAuth } = require("firebase-admin/auth");
const { getFirestore } = require("firebase-admin/firestore");
const { defineSecret } = require("firebase-functions/params");

setGlobalOptions({ region: "asia-south1", maxInstances: 1 });
initializeApp();

const ADMIN_UID = "AInbtkxwW0UVMWdh12HCWNcDn1l2";
const WIPE_CONFIRMATION = "WIPE EVERYTHING";
const GITHUB_ACTIONS_TOKEN = defineSecret("GITHUB_ACTIONS_TOKEN");
const GITHUB_REPOSITORY = "navneet-pathak76/-repo";
const GITHUB_WORKFLOW = "publish-ota.yml";

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


exports.publishLatestUpdate = onCall(
  { secrets: [GITHUB_ACTIONS_TOKEN] },
  async (request) => {
    if (!request.auth || request.auth.uid !== ADMIN_UID) {
      throw new HttpsError("permission-denied", "Admin access required.");
    }

    const token = GITHUB_ACTIONS_TOKEN.value();
    if (!token) {
      throw new HttpsError(
        "failed-precondition",
        "The GitHub Actions token is not configured on the server."
      );
    }

    const response = await fetch(
      `https://api.github.com/repos/${GITHUB_REPOSITORY}/actions/workflows/${GITHUB_WORKFLOW}/dispatches`,
      {
        method: "POST",
        headers: {
          Accept: "application/vnd.github+json",
          Authorization: `Bearer ${token}`,
          "X-GitHub-Api-Version": "2026-03-10",
          "Content-Type": "application/json",
          "User-Agent": "RP-Exchange-Admin",
        },
        body: JSON.stringify({ ref: "main" }),
      }
    );

    if (!response.ok) {
      const body = await response.text();
      console.error("GitHub workflow dispatch failed", response.status, body);
      throw new HttpsError(
        "internal",
        `GitHub rejected the update request (HTTP ${response.status}).`
      );
    }

    return {
      ok: true,
      message: "The latest main-branch update has been queued for publication to all compatible users.",
    };
  }
);
