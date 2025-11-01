<script>
// ========== TAB SWITCHING ==========
const tabButtons = document.querySelectorAll(".tab-button");
const tabContents = document.querySelectorAll(".tab-content");

tabButtons.forEach(button => {
  button.addEventListener("click", () => {
    tabButtons.forEach(btn => btn.classList.remove("active"));
    tabContents.forEach(tab => tab.classList.remove("active"));
    button.classList.add("active");
    document.getElementById(button.dataset.tab).classList.add("active");
  });
});

// ========== LOCAL USER DATA ==========
let userData = JSON.parse(localStorage.getItem("userData")) || {
  isPro: false,
  diagnosisCount: 0,
  referralCount: 0,
  lastReset: new Date().toISOString().split("T")[0],
  referralId: null,
  userId: null,
};

const saveUserData = () => localStorage.setItem("userData", JSON.stringify(userData));

// Assign userId automatically if missing
if (!userData.userId) {
  userData.userId = "U" + Math.random().toString(36).substring(2, 10);
  saveUserData();
}

// Reset weekly limit every Monday
(function resetWeeklyLimit() {
  const today = new Date();
  const last = new Date(userData.lastReset);
  const days = (today - last) / (1000 * 60 * 60 * 24);
  if (days > 7) {
    userData.diagnosisCount = 0;
    userData.lastReset = today.toISOString().split("T")[0];
    saveUserData();
  }
})();

// ========== FARM RECORDS ==========
const form = document.getElementById("recordForm");
const tableBody = document.querySelector("#recordsTable tbody");
let records = JSON.parse(localStorage.getItem("farmRecords")) || [];

function renderRecords() {
  tableBody.innerHTML = "";
  let totalFish = 0, totalFeed = 0, totalExpense = 0;

  records.forEach((r, i) => {
    totalFish += parseInt(r.fishCount) || 0;
    totalFeed += parseFloat(r.feedUsed) || 0;
    totalExpense += parseFloat(r.expense) || 0;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${r.date}</td>
      <td>${r.pondName}</td>
      <td>${r.fishCount}</td>
      <td>${r.feedUsed}</td>
      <td>${r.expense}</td>
      <td>${r.notes}</td>
      <td class="actions">
        <button class="action-btn edit" onclick="editRecord(${i})">✏️</button>
        <button class="action-btn delete" onclick="deleteRecord(${i})">🗑️</button>
      </td>`;
    tableBody.appendChild(row);
  });

  document.getElementById("totalFish").textContent = totalFish;
  document.getElementById("totalFeed").textContent = totalFeed.toFixed(1);
  document.getElementById("totalExpense").textContent = totalExpense.toLocaleString();

  localStorage.setItem("farmRecords", JSON.stringify(records));
}

form.addEventListener("submit", e => {
  e.preventDefault();
  const newRecord = {
    date: form.date.value || new Date().toISOString().split("T")[0],
    pondName: form.pondName.value,
    fishCount: form.fishCount.value,
    feedUsed: form.feedUsed.value,
    expense: form.expense.value,
    notes: form.notes.value
  };
  records.push(newRecord);
  renderRecords();
  form.reset();
  form.date.value = new Date().toISOString().split("T")[0];
});

function deleteRecord(index) {
  records.splice(index, 1);
  renderRecords();
}

function editRecord(index) {
  const r = records[index];
  form.date.value = r.date;
  form.pondName.value = r.pondName;
  form.fishCount.value = r.fishCount;
  form.feedUsed.value = r.feedUsed;
  form.expense.value = r.expense;
  form.notes.value = r.notes;
  deleteRecord(index);
}

document.addEventListener("DOMContentLoaded", () => {
  const dateInput = document.getElementById("date");
  if (dateInput) dateInput.value = new Date().toISOString().split("T")[0];
});

renderRecords();

// ========== MAKE WEBHOOK ==========
const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/nx13ilko39doy4w6cdo4e9mch2irl8uf";

// Helper to send to Make
function sendToMake(eventType, payload = {}) {
  console.log("🔥 Sending to Make:", eventType, payload);
  fetch(MAKE_WEBHOOK_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ event: eventType, ...payload }),
  }).catch(err => console.error("❌ Make webhook error:", err));
}

// ========== AI DISEASE DIAGNOSIS ==========
document.getElementById("diagnoseBtn").addEventListener("click", async () => {
  const input = document.getElementById("diseaseInput").value.trim();
  const resultDiv = document.getElementById("diagnosisResult");

  if (!userData.isPro && userData.diagnosisCount >= 2) {
    resultDiv.innerHTML = `
      <p style="color:red;">Free limit reached (2 diagnoses/week). 
      <br>Upgrade to Pro for unlimited access or refer 3 users for 1 month free.</p>
      <div class="upgrade-inline">
        <input type="email" id="upgradeEmail" placeholder="Enter your email" required />
        <button id="continuePaystack" class="upgrade-btn">Pay ₦1,500 to Upgrade</button>
      </div>
      <button id="referBtn" class="refer-btn">Refer Friends</button>`;
    return;
  }

  resultDiv.innerHTML = "<p>Analyzing symptoms...</p>";

  try {
    const response = await fetch("/api/claude", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "claude-3-5-sonnet-20241022",
        max_tokens: 500,
        messages: [
          {
            role: "user",
            content: `You are an aquaculture expert. Based on this description: "${input}", identify the likely fish disease, recommend treatment, and give prevention steps. 
            Format your response strictly as a JSON object with keys: diagnosis, treatment, prevention.`
          }
        ]
      })
    });

    const data = await response.json();
    let text = data.content?.[0]?.text || "";
    text = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch {
      parsed = { diagnosis: "Could not extract structured diagnosis.", treatment: text, prevention: "Try rephrasing or adding more detail about symptoms." };
    }

    const formatMultiline = str => str.replace(/\d+\)/g, match => `<br><strong>${match}</strong>`);

    resultDiv.innerHTML = `
      <div class="ai-card"><h3>Diagnosis</h3><p>${parsed.diagnosis}</p></div>
      <div class="ai-card"><h3>Treatment</h3><p>${formatMultiline(parsed.treatment)}</p></div>
      <div class="ai-card"><h3>Prevention</h3><p>${formatMultiline(parsed.prevention)}</p></div>
      ${userData.isPro ? `<button id="saveDiagnosisBtn" class="save-btn">💾 Save This Diagnosis</button>` : ""}
    `;

    userData.diagnosisCount++;
    saveUserData();

    // Log usage
    sendToMake("usage_update", {
      userId: userData.userId,
      diagnosisCount: userData.diagnosisCount,
      isPro: userData.isPro,
      date: new Date().toISOString(),
    });

  } catch (err) {
    console.error("Claude API Error:", err);
    resultDiv.innerHTML = `<p style="color:red;">Error connecting to AI diagnosis server.</p>`;
  }
});

// ========== REFERRAL + PAYSTACK ==========

// Handle referral via URL
const params = new URLSearchParams(window.location.search);
const ref = params.get("ref");
if (ref && ref !== userData.userId) {
  userData.referredBy = ref;
  saveUserData();
  sendToMake("referral", {
    referred_by: ref,
    newUserId: userData.userId,
    date: new Date().toISOString(),
  });
}

// Paystack Payment Function
function openPaystack(email) {
  if (typeof PaystackPop === "undefined") {
    alert("⚠️ Paystack library not loaded. Please check your internet or script tag.");
    return;
  }

  const btn = document.getElementById("continuePaystack");
  btn.disabled = true;
  btn.textContent = "Processing...";

  const handler = PaystackPop.setup({
    key: "pk_test_dd056cfe734e3a011b3802eb0aef6f165e04d0a5",
    email,
    amount: 150000,
    currency: "NGN",
    callback: response => {
      console.log("✅ Paystack callback triggered:", response);
      alert("✅ Payment successful! You now have unlimited access.");
      userData.isPro = true;
      userData.paymentRef = response.reference;
      userData.upgradeDate = new Date().toISOString();
      saveUserData();

      sendToMake("payment_success", {
        email,
        reference: response.reference,
        userId: userData.userId,
        date: new Date().toISOString(),
      });

      location.reload();
    },
    onClose: () => {
      alert("Payment window closed.");
      btn.disabled = false;
      btn.textContent = "Pay ₦1,500 to Upgrade";
    },
  });

  handler.openIframe();
}

// Referral handler
function handleReferral() {
  const referralId = userData.referralId || userData.userId;
  userData.referralId = referralId;
  saveUserData();
  const link = `${window.location.origin}?ref=${referralId}`;
  navigator.clipboard.writeText(link);
  alert(`✅ Your referral link copied!\n${link}\n\nRefer 3 users to unlock 1-month Pro access.`);

  sendToMake("referral_shared", {
    referralId,
    userId: userData.userId,
    date: new Date().toISOString(),
  });
}

// Check referral reward
function checkReferralBonus() {
  if (userData.referralCount >= 3 && !userData.isPro) {
    userData.isPro = true;
    userData.referralBonusDate = new Date().toISOString();
    saveUserData();
    alert("🎉 You’ve unlocked 1-month Pro via referrals!");
  }
}

// Dynamic button listeners
document.addEventListener("click", e => {
  if (e.target.id === "continuePaystack") {
    const email = document.getElementById("upgradeEmail").value.trim();
    if (email) openPaystack(email);
    else alert("Please enter your email to continue.");
  }
  if (e.target.id === "referBtn") handleReferral();
  if (e.target.id === "saveDiagnosisBtn") alert("✅ Diagnosis saved (Pro feature).");
});

checkReferralBonus();

// ========== CALCULATORS ==========
document.getElementById("calcFCR").addEventListener("click", () => {
  const feed = parseFloat(document.getElementById("feedGiven").value);
  const initial = parseFloat(document.getElementById("initialWeight").value);
  const final = parseFloat(document.getElementById("finalWeight").value);
  if (!feed || !initial || !final || final <= initial)
    return (document.getElementById("fcrResult").textContent = "Please enter valid values.");
  const fcr = feed / (final - initial);
  document.getElementById("fcrResult").textContent = `FCR: ${fcr.toFixed(2)}`;
});

document.getElementById("calcFeedQty").addEventListener("click", () => {
  const sampleCount = parseFloat(document.getElementById("sampleCount").value);
  const sampleWeight = parseFloat(document.getElementById("sampleWeight").value);
  const unit = document.getElementById("weightUnit").value;
  const age = parseInt(document.getElementById("fishAge").value);
  const totalFish = parseInt(document.getElementById("totalFishCount").value);
  if (!sampleCount || !sampleWeight || !age || !totalFish)
    return (document.getElementById("feedQtyResult").textContent = "Please enter all fields.");
  let avgWeight = sampleWeight / sampleCount;
  if (unit === "g") avgWeight /= 1000;
  let feedRate = 0.05;
  if (age < 4) feedRate = 0.08;
  else if (age < 8) feedRate = 0.06;
  else if (age < 12) feedRate = 0.04;
  else if (age < 20) feedRate = 0.025;
  else feedRate = 0.015;
  const totalFeed = (avgWeight * totalFish * feedRate).toFixed(2);
  document.getElementById("feedQtyResult").textContent = `Feed Quantity: ${totalFeed} kg/day`;
});
</script>
