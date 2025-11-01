document.addEventListener("DOMContentLoaded", () => {
  const continueBtn = document.getElementById("continueBtn");
  const emailInput = document.getElementById("userEmail");
  const referralInput = document.getElementById("referralCode");
  const signupModal = document.getElementById("signupModal");
  const appContainer = document.getElementById("appContainer");
  const footer = document.getElementById("appFooter");

  const MAKE_EVENT_WEBHOOK = "https://hook.eu2.make.com/nx13ilko39doy4w6cdo4e9mch2irl8uf";
  const MAKE_GET_USER_WEBHOOK = "https://hook.eu2.make.com/j5dg9c4wmfno9h5vbgb8ue6wfj14824h"; 

  const urlParams = new URLSearchParams(window.location.search);
  const refFromLink = urlParams.get("ref");
  if (refFromLink) referralInput.value = refFromLink;

  let user = JSON.parse(localStorage.getItem("myfishdoc_user"));
  if (user) {
    signupModal?.classList.add("hidden");
    appContainer?.classList.remove("hidden");
    footer?.classList.remove("hidden");
  }

  function generateUserId() {
    return "user_" + Math.random().toString(36).substring(2, 9);
  }

  async function sendWebhook(eventType, data) {
    try {
      await fetch(MAKE_EVENT_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ event: eventType, ...data }),
      });
    } catch (err) {
      console.error(`Webhook error (${eventType}):`, err);
    }
  }

  async function getUserDataFromMake(userId, email) {
    try {
      const res = await fetch(MAKE_GET_USER_WEBHOOK, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId, email }),
      });
      return await res.json();
    } catch (err) {
      console.error("Error fetching user data from Make:", err);
      return null;
    }
  }

  // ===== SIGNUP BUTTON =====
  continueBtn?.addEventListener("click", async () => {
    const email = emailInput.value.trim();
    const referralCode = referralInput.value.trim();

    if (!email) { alert("Please enter your email."); return; }

    user = {
      userId: generateUserId(),
      email,
      referredBy: referralCode || refFromLink || null,
      referralCount: 0,
      isPro: false,
      diagnosisCount: 0,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem("myfishdoc_user", JSON.stringify(user));
    await sendWebhook("signup", user);

    if (user.referredBy) {
      await sendWebhook("referral_used", {
        referrer: user.referredBy,
        newUser: user.email,
      });
    }

    signupModal?.classList.add("hidden");
    appContainer?.classList.remove("hidden");
    footer?.classList.remove("hidden");

    alert("Welcome to MyFishDoc! Your account has been created.");
  });

  // ===== TAB SWITCHING =====
  document.querySelectorAll(".tab-button").forEach(button => {
    button.addEventListener("click", () => {
      document.querySelectorAll(".tab-button").forEach(btn => btn.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(tab => tab.classList.remove("active"));
      button.classList.add("active");
      document.getElementById(button.dataset.tab)?.classList.add("active");
    });
  });

  // ===== REFERRAL =====
  function handleReferral() {
    const user = JSON.parse(localStorage.getItem("myfishdoc_user"));
    if (!user) { alert("Please sign up first."); return; }
    const referralLink = `${window.location.origin}?ref=${user.userId}`;
    navigator.clipboard.writeText(referralLink);
    alert(`Referral link copied!\n\n${referralLink}\n\nShare this with friends.`);
  }

  document.addEventListener("click", e => {
    if (e.target.id === "referBtn") handleReferral();
  });

  // ===== FARM RECORDS =====
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
          <button class="action-btn edit" data-index="${i}">✏️</button>
          <button class="action-btn delete" data-index="${i}">🗑️</button>
        </td>`;
      tableBody.appendChild(row);
    });

    ["totalFish", "totalFeed", "totalExpense"].forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      if (id === "totalFish") el.textContent = totalFish;
      if (id === "totalFeed") el.textContent = totalFeed.toFixed(1);
      if (id === "totalExpense") el.textContent = totalExpense.toLocaleString();
    });

    localStorage.setItem("farmRecords", JSON.stringify(records));
  }

  form?.addEventListener("submit", e => {
    e.preventDefault();
    records.push({
      date: form.date.value || new Date().toISOString().split("T")[0],
      pondName: form.pondName.value,
      fishCount: form.fishCount.value,
      feedUsed: form.feedUsed.value,
      expense: form.expense.value,
      notes: form.notes.value,
    });
    renderRecords();
    form.reset();
  });

  tableBody?.addEventListener("click", e => {
    const idx = e.target.dataset.index;
    if (!idx) return;
    if (e.target.classList.contains("delete")) {
      records.splice(idx, 1);
      renderRecords();
    }
    if (e.target.classList.contains("edit")) {
      const r = records[idx];
      form.date.value = r.date;
      form.pondName.value = r.pondName;
      form.fishCount.value = r.fishCount;
      form.feedUsed.value = r.feedUsed;
      form.expense.value = r.expense;
      form.notes.value = r.notes;
      records.splice(idx, 1);
      renderRecords();
    }
  });

  renderRecords();

  // ===== AI DISEASE DIAGNOSIS =====
  const diagnoseBtn = document.getElementById("diagnoseBtn");
  diagnoseBtn?.addEventListener("click", async () => {
    const input = document.getElementById("diseaseInput").value.trim();
    const resultDiv = document.getElementById("diagnosisResult");

    if (!user) { alert("Please sign up first."); return; }
    if (!input) { alert("Please describe the fish symptoms."); return; }

    // Fetch latest user data from Make (includes weekly reset and pro unlock)
    const liveUserData = await getUserDataFromMake(user.userId, user.email);
    if (liveUserData) {
      user = liveUserData;
      localStorage.setItem("myfishdoc_user", JSON.stringify(user));
    }

    if (!user.isPro && user.diagnosisCount >= 2) {
      resultDiv.innerHTML = `<p style="color:red;">Free limit reached (2 per week).<br> Invite 3 users to unlock unlimited access.</p>
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
            { role: "user", content: `YYou are an aquaculture expert with over 20 years of experience. Based on this description: "${input}", identify the likely fish disease, recommend treatment, and prevention steps. Format strictly as JSON with keys: diagnosis, treatment, prevention.` },
          ],
        }),
      });

      const data = await response.json();
      let text = data.content?.[0]?.text || "";
      text = text.replace(/```json|```/g, "").trim();

      let parsed;
      try { parsed = JSON.parse(text); } 
      catch { parsed = { diagnosis: "Could not extract structured diagnosis.", treatment: text, prevention: "Try rephrasing your input." }; }

      function formatText(text) { return text.replace(/\n/g, "<br>").replace(/\d+\.\s/g, "<br><strong>$&</strong>").replace(/\-\s/g, "<br>• "); }

      resultDiv.innerHTML = `<div class="ai-card"><h3>Diagnosis</h3><p>${formatText(parsed.diagnosis)}</p></div>
        <div class="ai-card"><h3>Treatment</h3><p>${formatText(parsed.treatment)}</p></div>
        <div class="ai-card"><h3>Prevention</h3><p>${formatText(parsed.prevention)}</p></div>`;

      // Send usage event to Make
      user.diagnosisCount += 1;
      localStorage.setItem("myfishdoc_user", JSON.stringify(user));
      await sendWebhook("diagnosis_used", {
        userId: user.userId,
        email: user.email,
        diagnosisCount: user.diagnosisCount,
        inputSymptoms: input,
      });
    } catch (err) {
      console.error("Claude API Error:", err);
      resultDiv.innerHTML = `<p style="color:red;">Error connecting to AI diagnosis.</p>`;
    }
  });

  // ===== CALCULATORS =====
  document.getElementById("calcFCR")?.addEventListener("click", () => {
    const feed = parseFloat(document.getElementById("feedGiven").value);
    const initial = parseFloat(document.getElementById("initialWeight").value);
    const final = parseFloat(document.getElementById("finalWeight").value);

    if (!feed || !initial || !final || final <= initial) {
      document.getElementById("fcrResult").textContent = "Please enter valid values.";
      return;
    }
    document.getElementById("fcrResult").textContent = `FCR: ${(feed / (final - initial)).toFixed(2)}`;
  });

  document.getElementById("calcFeedQty")?.addEventListener("click", () => {
    const sampleCount = parseFloat(document.getElementById("sampleCount").value);
    const sampleWeight = parseFloat(document.getElementById("sampleWeight").value);
    const unit = document.getElementById("weightUnit").value;
    const age = parseInt(document.getElementById("fishAge").value);
    const totalFish = parseInt(document.getElementById("totalFishCount").value);

    if (!sampleCount || !sampleWeight || !age || !totalFish) {
      document.getElementById("feedQtyResult").textContent = "Please enter all fields.";
      return;
    }

    let avgWeight = sampleWeight / sampleCount;
    if (unit === "g") avgWeight /= 1000;

    let feedRate = 0.05;
    if (age < 4) feedRate = 0.08;
    else if (age < 8) feedRate = 0.06;
    else if (age < 12) feedRate = 0.04;
    else if (age < 20) feedRate = 0.025;
    else feedRate = 0.015;

    document.getElementById("feedQtyResult").textContent = `Feed Quantity: ${(avgWeight * totalFish * feedRate).toFixed(2)} kg/day`;
  });

});
