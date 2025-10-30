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
  const today = new Date().toISOString().split("T")[0];
  form.date.value = today;
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
  if (dateInput) {
    const today = new Date().toISOString().split("T")[0];
    dateInput.value = today;
  }
});

renderRecords();

// ========== AI DISEASE DIAGNOSIS ==========
document.getElementById("diagnoseBtn").addEventListener("click", async () => {
  const input = document.getElementById("diseaseInput").value.trim();
  const resultDiv = document.getElementById("diagnosisResult");
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
            Format your response strictly as a JSON object with keys: diagnosis, treatment, prevention. 
            For treatment and prevention, use numbered points (1), 2), etc.), each on a new line.`
          }
        ]
      })
    });

    const data = await response.json();
    let text = data.content?.[0]?.text || "";

    // Clean up markdown or code block wrappers
    text = text.replace(/```json|```/g, "").trim();

    let parsed;
    try {
      parsed = JSON.parse(text);
    } catch (err) {
      console.error("JSON parse failed, fallback to plain text.");
      parsed = {
        diagnosis: "Could not extract structured diagnosis. Here's what the AI said:",
        treatment: text,
        prevention: "Try rephrasing or adding more detail about symptoms."
      };
    }

    const formatMultiline = str =>
      str.replace(/\d+\)/g, match => `<br><strong>${match}</strong>`);

    resultDiv.innerHTML = `
      <div class="ai-card">
        <h3>Diagnosis</h3>
        <p>${parsed.diagnosis.replace(/\n/g, "<br>")}</p>
      </div>
      <div class="ai-card">
        <h3>Treatment</h3>
        <p>${formatMultiline(parsed.treatment)}</p>
      </div>
      <div class="ai-card">
        <h3>Prevention</h3>
        <p>${formatMultiline(parsed.prevention)}</p>
      </div>
    `;
  } catch (err) {
    console.error("Claude API Error:", err);
    resultDiv.innerHTML = `<p style="color:red;">Error connecting to Claude API</p>`;
  }
});

// ========== CALCULATORS ==========
// Feed Conversion Ratio (FCR)
document.getElementById("calcFCR").addEventListener("click", () => {
  const feed = parseFloat(document.getElementById("feedGiven").value);
  const initial = parseFloat(document.getElementById("initialWeight").value);
  const final = parseFloat(document.getElementById("finalWeight").value);

  if (!feed || !initial || !final || final <= initial) {
    return (document.getElementById("fcrResult").textContent =
      "Please enter valid values.");
  }

  const fcr = feed / (final - initial);
  document.getElementById("fcrResult").textContent = `FCR: ${fcr.toFixed(2)}`;
});

// Feed Quantity Calculator
document.getElementById("calcFeedQty").addEventListener("click", () => {
  const sampleCount = parseFloat(document.getElementById("sampleCount").value);
  const sampleWeight = parseFloat(document.getElementById("sampleWeight").value);
  const unit = document.getElementById("weightUnit").value;
  const age = parseInt(document.getElementById("fishAge").value);
  const totalFish = parseInt(document.getElementById("totalFishCount").value);

  if (!sampleCount || !sampleWeight || !age || !totalFish) {
    return (document.getElementById("feedQtyResult").textContent =
      "Please enter all fields.");
  }

  let avgWeight = sampleWeight / sampleCount;
  if (unit === "g") avgWeight /= 1000;

  let feedRate = 0.05;
  if (age < 4) feedRate = 0.08;
  else if (age < 8) feedRate = 0.06;
  else if (age < 12) feedRate = 0.04;
  else if (age < 20) feedRate = 0.025;
  else feedRate = 0.015;

  const totalFeed = (avgWeight * totalFish * feedRate).toFixed(2);
  document.getElementById(
    "feedQtyResult"
  ).textContent = `Feed Quantity: ${totalFeed} kg/day`;
});

