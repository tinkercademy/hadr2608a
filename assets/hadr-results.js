(() => {
  const API = "/api/hadr";
  const form = document.querySelector("#result-form");
  const publishButton = form?.querySelector("button[type='submit']");
  const formMessage = document.querySelector("#form-message");
  const challengeError = document.querySelector("#challenge-error");
  const resultsBody = document.querySelector("#results-body");
  const refreshButton = document.querySelector("#refresh-results");
  const copyPromptButton = document.querySelector("#copy-agent-prompt");
  const promptText = document.querySelector("#agent-prompt-text");
  let challenge;

  const number = (formData, name) => Number(formData.get(name));
  const text = (formData, name) => String(formData.get(name) || "").trim();
  const formatNumber = new Intl.NumberFormat("en-SG");
  const shortModel = (value) => (value.length > 24 ? `${value.slice(0, 23)}…` : value);

  const showMessage = (element, message, state = "") => {
    if (!element) return;
    element.textContent = message;
    element.classList.toggle("is-error", state === "error");
    element.classList.toggle("is-success", state === "success");
    element.hidden = !message;
  };

  const fetchJson = async (url, options) => {
    const response = await fetch(url, options);
    let body;
    try {
      body = await response.json();
    } catch {
      body = { error: `Server returned ${response.status}.` };
    }
    if (!response.ok) {
      const details = Array.isArray(body.details) ? ` ${body.details.join(" ")}` : "";
      throw new Error(`${body.error || "Request failed."}${details}`);
    }
    return body;
  };

  const loadChallenge = async () => {
    try {
      challenge = await fetchJson(`${API}/challenge`);
      document.querySelector("#challenge-title").textContent = challenge.title;
      document.querySelector("#challenge-scenario").textContent = challenge.scenario;
      document.querySelector("#challenge-seed").textContent = challenge.seed;
      document.querySelector("#challenge-state").textContent = challenge.submissionsOpen
        ? "Open"
        : "Closed";
      document.querySelector("#challenge-command").textContent =
        `uv run hadr-runner ${challenge.scenario} --seed ${challenge.seed}`;
      publishButton.disabled = !challenge.submissionsOpen;
      if (!challenge.submissionsOpen) {
        showMessage(formMessage, "The result board is closed.");
      }
    } catch (error) {
      showMessage(challengeError, `Could not load the challenge. ${error.message}`, "error");
      document.querySelector("#challenge-state").textContent = "Unavailable";
    }
  };

  const addCell = (row, value, className = "") => {
    const cell = document.createElement("td");
    cell.textContent = value;
    if (className) cell.className = className;
    row.appendChild(cell);
  };

  const renderResults = (results) => {
    resultsBody.replaceChildren();
    if (!results.length) {
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.textContent = "No runs yet. Complete the challenge and put the first result on the board.";
      row.appendChild(cell);
      resultsBody.appendChild(row);
      return;
    }

    results.forEach((result, index) => {
      const row = document.createElement("tr");
      addCell(row, String(index + 1), "result-order");
      addCell(row, result.displayName);
      addCell(row, formatNumber.format(result.casualties), "result-score");
      addCell(row, formatNumber.format(result.buildingsLost), "result-score");
      addCell(row, formatNumber.format(result.tokens.total));
      addCell(row, `${shortModel(result.intakeModel)} / ${shortModel(result.dispatchModel)}`);
      addCell(row, `${result.runId} · ${result.gitCommit.slice(0, 7)}`);
      resultsBody.appendChild(row);
    });
  };

  const loadResults = async () => {
    refreshButton.disabled = true;
    try {
      const response = await fetchJson(`${API}/results`);
      renderResults(response.results);
    } catch (error) {
      resultsBody.replaceChildren();
      const row = document.createElement("tr");
      const cell = document.createElement("td");
      cell.colSpan = 7;
      cell.textContent = `Could not load results. ${error.message}`;
      row.appendChild(cell);
      resultsBody.appendChild(row);
    } finally {
      refreshButton.disabled = false;
    }
  };

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (!challenge || !challenge.submissionsOpen) return;
    const formData = new FormData(form);
    const intake = number(formData, "intakeTokens");
    const dispatch = number(formData, "dispatchTokens");
    const submission = {
      challengeId: challenge.id,
      displayName: text(formData, "displayName"),
      scenario: challenge.scenario,
      seed: challenge.seed,
      runId: text(formData, "runId"),
      terminalReason: text(formData, "terminalReason"),
      tick: number(formData, "tick"),
      casualties: number(formData, "casualties"),
      buildingsLost: number(formData, "buildingsLost"),
      tokens: { intake, dispatch, total: intake + dispatch },
      intakeModel: text(formData, "intakeModel"),
      dispatchModel: text(formData, "dispatchModel"),
      gitCommit: text(formData, "gitCommit"),
    };

    publishButton.disabled = true;
    showMessage(formMessage, "Publishing result…");
    try {
      const response = await fetchJson(`${API}/results`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-submission-code": text(formData, "submissionCode"),
        },
        body: JSON.stringify(submission),
      });
      form.elements.submissionCode.value = "";
      showMessage(formMessage, response.message, "success");
      await loadResults();
    } catch (error) {
      showMessage(formMessage, error.message, "error");
    } finally {
      publishButton.disabled = !challenge.submissionsOpen;
    }
  });

  refreshButton?.addEventListener("click", loadResults);
  copyPromptButton?.addEventListener("click", async () => {
    try {
      await navigator.clipboard.writeText(promptText.textContent.trim());
      copyPromptButton.textContent = "Copied";
      copyPromptButton.classList.add("is-done");
      setTimeout(() => {
        copyPromptButton.textContent = "Copy prompt";
        copyPromptButton.classList.remove("is-done");
      }, 2000);
    } catch {
      const range = document.createRange();
      range.selectNodeContents(promptText);
      getSelection().removeAllRanges();
      getSelection().addRange(range);
      copyPromptButton.textContent = "Press Ctrl+C";
    }
  });
  loadChallenge();
  loadResults();
})();
