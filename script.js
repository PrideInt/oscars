const featured = document.getElementById("featured");
const grid = document.getElementById("grid");

const shouldToggle = document.getElementById("showShould");
const scoreText = document.getElementById("scoreText");
const emptyText = document.getElementById("emptyText");

const DATA_FILE = "predictions.json";

const CONFIDENCE_LABELS = {
    lock: "Lock",
    likely: "Likely",
    tossup: "Toss-up"
};

const PLACEHOLDERS = {
    pick: "No pick yet",
    nominee: "TBA",
    nominees: "Nominees not announced yet."
};

let categories = [];

shouldToggle.addEventListener("change", () => {
    document.body.classList.toggle("hide-should", !shouldToggle.checked);
});

window.addEventListener("resize", fitNames);

loadPredictions();

async function loadPredictions() {
    let data;

    try {
        const response = await fetch(DATA_FILE, { cache: "no-cache" });

        if (!response.ok) {
            throw new Error(response.status + " " + response.statusText);
        }

        data = await response.json();
    } catch (error) {
        showLoadError(error);
        return;
    }

    if (!data || typeof data !== "object") {
        data = {};
    }

    fillSiteInfo(data.site);
    renderCategories(data.categories);

    categories = document.querySelectorAll(".category");

    setupPhotos();
    markResults();

    fitNames();
    document.fonts.ready.then(fitNames);
}

function showLoadError(error) {
    console.error(`Couldn't load ${DATA_FILE}:`, error);

    emptyText.textContent =
        `Couldn't load ${DATA_FILE} (${error.message}). ` +
        "If you opened index.html straight from a folder, run it from a local server instead.";

    emptyText.hidden = false;
}

function fillSiteInfo(site) {
    if (!site || typeof site !== "object") {
        site = {};
    }

    document.getElementById("siteEdition").textContent = cleanText(site.edition) || "Academy Awards";
    document.getElementById("siteCeremony").textContent = cleanText(site.ceremony) || "TBA";
    document.getElementById("siteAuthor").textContent = cleanText(site.author) || "me";

    if (cleanText(site.updated)) {
        document.getElementById("siteUpdated").textContent = "Updated " + cleanText(site.updated) + ".";
    }
}

function cleanText(value) {
    if (typeof value === "string" || typeof value === "number") {
        return String(value).trim();
    }

    return "";
}

function cleanCategory(raw, index) {
    if (!raw || typeof raw !== "object") {
        raw = {};
    }

    const confidence = cleanText(raw.confidence).toLowerCase();

    if (confidence && !CONFIDENCE_LABELS[confidence]) {
        console.warn(`Category ${index + 1}: confidence "${confidence}" should be lock, likely or tossup.`);
    }

    return {
        title: cleanText(raw.title) || "Category " + (index + 1),
        featured: raw.featured === true,
        kind: raw.kind === "person" ? "person" : "film",
        confidence: CONFIDENCE_LABELS[confidence] ? confidence : "",
        pick: cleanText(raw.pick),
        shouldWin: cleanText(raw.shouldWin),
        why: cleanText(raw.why),
        winner: cleanText(raw.winner),
        nominees: Array.isArray(raw.nominees) ? raw.nominees.map(cleanNominee) : []
    };
}

function cleanNominee(raw) {
    if (typeof raw === "string") {
        return { name: raw.trim(), detail: "", photo: "" };
    }

    if (!raw || typeof raw !== "object") {
        raw = {};
    }

    return {
        name: cleanText(raw.name),
        detail: cleanText(raw.detail),
        photo: cleanText(raw.photo)
    };
}

function renderCategories(list) {
    if (!Array.isArray(list) || list.length === 0) {
        emptyText.textContent = `No categories in ${DATA_FILE} yet.`;
        emptyText.hidden = false;
        return;
    }

    list.forEach((raw, index) => {
        try {
            const category = cleanCategory(raw, index);

            if (category.pick && category.nominees.length && !findPick(category)) {
                console.warn(`"${category.title}": pick "${category.pick}" isn't in its nominees list.`);
            }

            if (category.featured) {
                featured.insertAdjacentHTML("beforeend", buildFeatured(category));
            } else {
                grid.insertAdjacentHTML("beforeend", buildCard(category));
            }
        } catch (error) {
            console.error(`Skipped category ${index + 1} in ${DATA_FILE}:`, error);
        }
    });
}

function buildFeatured(category) {
    const pick = findPick(category) || { name: category.pick, photo: "" };

    return `
        <section class="card featured category" ${buildDataAttributes(category)}>
            <div class="featured-top">
                ${buildPhoto(pick.photo, pick.name, "hero")}

                <div class="featured-text">
                    <div class="card-head">
                        <h2>${escapeHTML(category.title)}</h2>
                        ${buildPill(category.confidence)}
                    </div>

                    <span class="will">Will win</span>
                    ${category.pick
                        ? `<p class="big-pick">${escapeHTML(category.pick)}</p>`
                        : `<p class="big-pick tba">${PLACEHOLDERS.pick}</p>`}
                    ${category.why ? `<p class="why">${escapeHTML(category.why)}</p>` : ""}
                    ${category.shouldWin ? `<p class="should">Should win <em>${escapeHTML(category.shouldWin)}</em></p>` : ""}
                </div>
            </div>

            <div class="nominees">
                <h3>The nominees</h3>

                ${category.nominees.length
                    ? `<ol class="ballot">${category.nominees.map((nominee) => buildNominee(nominee, category)).join("")}</ol>`
                    : `<p class="tba">${PLACEHOLDERS.nominees}</p>`}
            </div>
        </section>
    `;
}

function buildCard(category) {
    const pick = findPick(category) || { name: category.pick, detail: "", photo: "" };
    const others = category.nominees.filter((nominee) => !isPick(nominee, category));

    return `
        <article class="card category" ${buildDataAttributes(category)}>
            <div class="card-head">
                <h3>${escapeHTML(category.title)}</h3>
                ${buildPill(category.confidence)}
            </div>

            <div class="nominee pick-row${category.pick ? " pick" : ""}" data-name="${escapeHTML(pick.name)}">
                ${buildPhoto(pick.photo, pick.name)}

                <div class="pick-text">
                    <span class="will">Will win</span>
                    ${category.pick
                        ? `<span class="name">${escapeHTML(pick.name)}</span>`
                        : `<span class="name tba">${PLACEHOLDERS.pick}</span>`}
                    ${pick.detail ? `<span class="sub">${escapeHTML(pick.detail)}</span>` : ""}
                </div>
            </div>

            ${others.length
                ? `<ul class="others">${others.map((nominee) => buildNominee(nominee, category)).join("")}</ul>`
                : ""}

            ${category.nominees.length === 0 ? `<p class="tba">${PLACEHOLDERS.nominees}</p>` : ""}

            ${category.shouldWin ? `<p class="should">Should win: <em>${escapeHTML(category.shouldWin)}</em></p>` : ""}
        </article>
    `;
}

function buildNominee(nominee, category) {
    const name = nominee.name || PLACEHOLDERS.nominee;
    const label = nominee.detail ? name + " — " + nominee.detail : name;

    return `
        <li class="nominee${isPick(nominee, category) ? " pick" : ""}" data-name="${escapeHTML(nominee.name)}" title="${escapeHTML(label)}">
            ${buildPhoto(nominee.photo, name)}

            <span class="name${nominee.name ? "" : " tba"}">${escapeHTML(name)}</span>
        </li>
    `;
}

function buildPhoto(photo, alt, extraClass = "") {
    const classes = ["photo", extraClass].filter(Boolean).join(" ");

    if (!photo) {
        return `<div class="${classes} empty"></div>`;
    }

    return `
        <div class="${classes}">
            <img src="${escapeHTML(photo)}" alt="${escapeHTML(alt)}" loading="lazy">
        </div>
    `;
}

function buildDataAttributes(category) {
    return [
        `data-kind="${category.kind}"`,
        `data-winner="${escapeHTML(category.winner)}"`
    ].join(" ");
}

function buildPill(confidence) {
    if (!confidence) {
        return "";
    }

    return `<span class="pill ${confidence}">${CONFIDENCE_LABELS[confidence]}</span>`;
}

function isPick(nominee, category) {
    return sameName(nominee.name, category.pick);
}

function sameName(a, b) {
    const normalize = (value) => String(value || "")
        .normalize("NFKC")
        .replace(/[‘’]/g, "'")
        .replace(/[“”]/g, '"')
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();

    return normalize(a) !== "" && normalize(a) === normalize(b);
}

function findPick(category) {
    return category.nominees.find((nominee) => isPick(nominee, category));
}

function escapeHTML(value) {
    return String(value || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function setupPhotos() {
    document.querySelectorAll(".photo img").forEach((img) => {
        if (img.complete && img.naturalWidth === 0) {
            showPlaceholder(img);
            return;
        }

        img.addEventListener("error", () => {
            showPlaceholder(img);
        });
    });
}

function showPlaceholder(img) {
    img.parentElement.classList.add("empty");
}

const MIN_NAME_SIZE = 9;

function fitNames() {
    document.querySelectorAll(".others .name, .ballot .name").forEach((name) => {
        name.style.fontSize = "";

        let size = parseFloat(getComputedStyle(name).fontSize);

        while (name.scrollWidth > name.clientWidth && size > MIN_NAME_SIZE) {
            size -= 0.5;
            name.style.fontSize = size + "px";
        }
    });
}

function markResults() {
    let picked = 0;
    let decided = 0;
    let correct = 0;

    categories.forEach((category) => {
        const winner = category.dataset.winner;
        const pick = category.querySelector(".nominee.pick");

        if (pick) {
            picked++;
        }

        if (!winner) {
            return;
        }

        category.querySelectorAll(".nominee").forEach((nominee) => {
            if (sameName(nominee.dataset.name, winner)) {
                nominee.classList.add("winner");
            }
        });

        if (!pick) {
            return;
        }

        const hit = sameName(pick.dataset.name, winner);

        decided++;

        if (hit) {
            correct++;
        }

        category.classList.add(hit ? "hit" : "miss");

        const badge = document.createElement("span");

        badge.className = hit ? "result hit" : "result miss";
        badge.textContent = hit ? "✓ Called it" : "✗ Missed";

        category.querySelector(".card-head").appendChild(badge);
    });

    if (decided === 0) {
        scoreText.textContent = picked + " of " + categories.length + " categories predicted";
        return;
    }

    scoreText.textContent = "Score: " + correct + " / " + decided + " correct";
}
