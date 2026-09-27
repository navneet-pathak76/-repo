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


exports.completeTransaction = onCall(async (request) => {
  if (!request.auth || request.auth.uid !== ADMIN_UID) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  const transactionId = String(request.data?.transactionId || "").trim();
  const transactionDetails = request.data?.details || {};
  if (!transactionId) {
    throw new HttpsError("invalid-argument", "Transaction ID is required.");
  }

  const db = getFirestore();
  const txRef = db.collection("transactions").doc(transactionId);

  const result = await db.runTransaction(async (transaction) => {
    const txSnap = await transaction.get(txRef);
    if (!txSnap.exists) {
      throw new HttpsError("not-found", "Transaction not found.");
    }

    const tx = txSnap.data();
    if (tx.balanceApplied === true && tx.status === "completed") {
      const userSnap = await transaction.get(db.collection("users").doc(tx.userId));
      return {
        alreadyCompleted: true,
        balance: Number(userSnap.data()?.balanceUsdt || 0),
      };
    }

    if (tx.status !== "approved") {
      throw new HttpsError("failed-precondition", "Only an approved transaction can be completed.");
    }

    const userRef = db.collection("users").doc(tx.userId);
    const userSnap = await transaction.get(userRef);
    const currentBalance = Number(userSnap.data()?.balanceUsdt || 0);
    const usdtAmount = Number(tx.usdtAmount || 0);

    if (!Number.isFinite(usdtAmount) || usdtAmount <= 0) {
      throw new HttpsError("failed-precondition", "Transaction has an invalid USDT amount.");
    }

    let nextBalance = currentBalance;
    if (tx.type === "buy") {
      nextBalance += usdtAmount;
    } else if (tx.type === "sell") {
      if (currentBalance < usdtAmount) {
        throw new HttpsError("failed-precondition", "User does not have enough USDT balance for this withdrawal.");
      }
      nextBalance -= usdtAmount;
    } else {
      throw new HttpsError("failed-precondition", "Unknown transaction type.");
    }

    transaction.set(userRef, {
      balanceUsdt: Number(nextBalance.toFixed(8)),
      updatedAt: new Date().toISOString(),
    }, { merge: true });

    transaction.update(txRef, {
      ...transactionDetails,
      status: "completed",
      balanceApplied: true,
      balanceBefore: Number(currentBalance.toFixed(8)),
      balanceChange: Number((tx.type === "buy" ? usdtAmount : -usdtAmount).toFixed(8)),
      balanceAfter: Number(nextBalance.toFixed(8)),
      updatedAt: new Date().toISOString(),
      processedAt: new Date().toISOString(),
    });

    return {
      alreadyCompleted: false,
      balance: Number(nextBalance.toFixed(8)),
    };
  });

  return {
    ok: true,
    message: result.alreadyCompleted
      ? "Transaction was already completed; no duplicate balance credit was applied."
      : "Transaction completed and the user's USDT balance was updated.",
    balanceUsdt: result.balance,
  };
});

exports.rebuildUserBalance = onCall(async (request) => {
  if (!request.auth || request.auth.uid !== ADMIN_UID) {
    throw new HttpsError("permission-denied", "Admin access required.");
  }

  const userId = String(request.data?.userId || "").trim();
  if (!userId) {
    throw new HttpsError("invalid-argument", "User ID is required.");
  }

  const db = getFirestore();
  const snap = await db.collection("transactions")
    .where("userId", "==", userId)
    .where("status", "==", "completed")
    .get();

  let balance = 0;
  snap.forEach((doc) => {
    const tx = doc.data();
    const amount = Number(tx.usdtAmount || 0);
    if (tx.type === "buy") balance += amount;
    if (tx.type === "sell") balance -= amount;
  });

  balance = Number(balance.toFixed(8));
  await db.collection("users").doc(userId).set({
    balanceUsdt: balance,
    updatedAt: new Date().toISOString(),
  }, { merge: true });

  return {
    ok: true,
    userId,
    balanceUsdt: balance,
    completedTransactions: snap.size,
  };
});
