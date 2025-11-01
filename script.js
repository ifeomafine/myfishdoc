document.addEventListener("DOMContentLoaded", async () => {
  // ========= TAB SWITCHING =========
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

  // ========= MAKE WEBHOOK =========
  const MAKE_WEBHOOK_URL = "https://hook.eu2.make.com/nx13ilko39doy4w6cdo4e9mch2irl8uf";

  async function sendToWebhook(payload) {
    try {
      await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      console.log("✅ Sent to Make webhook:", payload);
    } catch (err) {
      console.error("❌ Webhook error:", err);
    }
  }

  // ========= USER DATA & REFERRAL =========
  let userData = JSON.parse(localStorage.getItem("userData")) || null;
  const urlParams = new URLSearchParams(window.location.search);
  const refFromLink = urlParams.get("ref");

  function generateUserId() {
    return "user_" + Math.random().toString(36).substring(2, 9);
  }

  async function registerUser(email, refCode) {
    if (!email || !email.includes("@")) {
      alert("Please enter a valid email address.");
      return;
    }

    userData = {
      userId: generateUserId(),
      email,
      isPro: false,
      diagnosisCount: 0,
      referralCount: 0,
      referredBy: refCode || refFromLink || null,
      createdAt: new Date().toISOString(),
    };

    localStorage.setItem("userData", JSON.stringify(userData));

    // Send signup event
    await sendToWebhook({
      event: "signup",
      userId: userData.userId,
      email: userData.email,
      referredBy: userData.referredBy,
      date: new Date().toISOString(),
    });

    // If referred by someone
    if (userData.referredBy) {
      await sendToWebhook({
        event: "referral_used",
        referrerId: userData.referredBy,
        newUserEmail: userData.email,
        newUserId: userData.userId,
        date: new Date().toISOString(),
      });
    }

    // Hide signup form, show app
    document.getElementById("signupSection").style.display = "none";
    document.getElementById("appSection").style.display = "block";
    alert("✅ Welcome! Your account has been created successfully.");
  }

  // ========= SIGNUP FORM HANDLER =========
  const signupForm = document.getElementById("signupForm");
  if (signupForm) {
    signupForm.addEventListener("submit", async e => {
      e.preventDefault();
      const email = document.getElementById("emailInput").value.trim();
      const refCode = document.getElementById("refInput").value.trim();
      await registerUser(email, refCode);
    });
  }

  // Auto-skip signup if already logged in
  if (userData) {
    document.getElementById("signupSection").style.display = "none";
    document.getElementById("appSection").style.display = "block";
  }

  // ========= REFERRAL =========
  function handleReferral() {
    const referralLink = `${window.location.origin}?ref=${userData.userId}`;
    navigator.clipboard.writeText(referralLink);

    alert(
      `✅ Referral link copied!\n\n${referralLink}\n\nShare this link with friends — refer 3 users to unlock Pro access.`
    );

    sendToWebhook({
      event: "referral_shared",
      userId: userData.userId,
      email: userData.email,
      date: new Date().toISOString(),
    });
  }

  function checkReferralBonus() {
    if (userData?.referralCount >= 3 && !userData.isPro) {
      userData.isPro = true;
      localStorage.setItem("userData", JSON.stringify(userData));
      alert("🎉 You’ve unlocked unlimited Pro access via referrals!");
    }
  }

  // ========= FARM RECORDS =========
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

    document.getElementById("totalFish").textContent = totalFish;
    document.getElementById("totalFeed").textContent = totalFeed.toFixed(1);
    document.getElementById("totalExpense").textContent = totalExpense.toLocaleString();

    localStorage.setItem("farmRecords", JSON.stringify(records));
  }

  form?.addEventListener("submit", e => {
    e.preventDefault();
    const newRecord = {
      date: form.date.value || new Date().toISOString().split("T")[0],
      pondName: form.pondName.value,
      fishCount: form.fishCount.value,
      feedUsed: form.feedUsed.value,
      expense: form.expense.value,
      notes: form.notes.value,
    };
    records.push(newRecord);
    renderRecords();
    form.reset();
  });

  tableBody?.addEventListener("click", e => {
    if (e.target.classList.contains("delete")) {
      const index = e.target.dataset.index;
      records.splice(index, 1);
      renderRecords();
    }
    if (e.target.classList.contains("edit")) {
      const index = e.target.dataset.index;
      const r = records[index];
      form.date.value = r.date;
      form.pondName.value = r.pondName;
      form.fishCount.value = r.fishCount;
      form.feedUsed.value = r.feedUsed;
      form.expense.value = r.expense;
      form.notes.value = r.notes;
      records.splice(index, 1);
      renderRecords();
    }
  });

  renderRecords();

  // ========= AI DISEASE DIAGNOSIS =========
  document.getElementById("diagnoseBtn")?.addEventListener("click", async () => {
    const input = document.getElementById("diseaseInput").value.trim();
    const resultDiv = document.getElementById("diagnosisResult");

    if (!userData?.isPro && (userData?.diagnosisCount || 0) >= 2) {
      resultDiv.innerHTML = `
        <p style="color:red;">Free limit reached (2 diagnoses/week).<br>
        Invite 3 users via your referral link for unlimited access.</p>
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
              content: `You are an aquaculture expert. Based on this description: "${input}", identify the likely fish disease, recommend treatment, and prevention steps. Format strictly as JSON with keys: diagnosis, treatment, prevention.`,
            },
          ],
        }),
      });

      const data = await response.json();
      let text = data.content?.[0]?.text || "";
      text = text.replace(/```json|```/g, "").trim();

      let parsed;
      try {
        parsed = JSON.parse(text);
      } catch {
        parsed = {
          diagnosis: "Could not extract structured diagnosis.",
          treatment: text,
          prevention: "Try rephrasing your input.",
        };
      }

      resultDiv.innerHTML = `
        <div class="ai-card"><h3>Diagnosis</h3><p>${parsed.diagnosis}</p></div>
        <div class="ai-card"><h3>Treatment</h3><p>${parsed.treatment}</p></div>
        <div class="ai-card"><h3>Prevention</h3><p>${parsed.prevention}</p></div>
      `;

      userData.diagnosisCount = (userData.diagnosisCount || 0) + 1;
      localStorage.setItem("userData", JSON.stringify(userData));
    } catch (err) {
      console.error("Claude API Error:", err);
      resultDiv.innerHTML = `<p style="color:red;">Error connecting to AI diagnosis.</p>`;
    }
  });

  document.addEventListener("click", e => {
    if (e.target.id === "referBtn") handleReferral();
  });

  checkReferralBonus();
});
