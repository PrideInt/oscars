const featured = document.getElementById("featured");
const grid = document.getElementById("grid");

const shouldToggle = document.getElementById("showShould");
const scoreText = document.getElementById("scoreText");
const emptyText = document.getElementById("emptyText");

const SNAPSHOTS = [
    { id: "current", label: "Current (NYFF)", date: "Latest", file: "predictions.json" },
    { id: "venice", label: "Venice", date: "Sep 12", file: "predictions-venice.json" },
    { id: "critics-choice", label: "Critics Choice", date: "Jan 3", file: "predictions-critics-choice.json" },
    { id: "golden-globes", label: "Golden Globes", date: "Jan 10", file: "predictions-golden-globes.json" },
    { id: "bafta", label: "BAFTA", date: "Feb 21", file: "predictions-bafta.json" },
    { id: "sag", label: "SAG", date: "Feb 28", file: "predictions-sag.json" },
];

const DEFAULT_SNAPSHOT = "current";

const CONFIDENCE_LABELS = {
    lock: "Lock",
    likely: "Likely",
    tossup: "Toss-up"
};

const PHOTO_FOLDERS = {
    film: "films",
    person: "people"
};

const PHOTO_EXTENSION = ".jpg";

const SPECIAL_LETTERS = {
    "ø": "o",
    "æ": "ae",
    "œ": "oe",
    "ß": "ss",
    "ł": "l",
    "đ": "d",
    "ð": "d",
    "þ": "th",
    "ı": "i"
};

const PLACEHOLDERS = {
    pick: "No pick yet",
    nominee: "TBA",
    nominees: "Nominees not announced yet."
};

let categories = [];
let currentFile = "";
let loadCount = 0;

const snapshotNav = buildSnapshotNav();

shouldToggle.addEventListener("change", () => {
    document.body.classList.toggle("hide-should", !shouldToggle.checked);
});

snapshotNav.addEventListener("click", (event) => {
    const button = event.target.closest(".snapshot");

    if (button) {
        showSnapshot(button.dataset.snapshot);
    }
});

window.addEventListener("hashchange", () => {
    showSnapshot(getSnapshotFromHash());
});

window.addEventListener("resize", fitNames);

showSnapshot(getSnapshotFromHash());

function buildSnapshotNav() {
    let nav = document.getElementById("snapshots");

    if (!nav) {
        nav = document.createElement("nav");
        nav.id = "snapshots";

        document.querySelector(".toolbar").before(nav);
    }

    nav.classList.add("snapshots");
    nav.setAttribute("aria-label", "Prediction snapshots");

    nav.innerHTML = SNAPSHOTS.map((snapshot) => `
        <button type="button" class="snapshot" data-snapshot="${snapshot.id}" aria-pressed="false">
            <span class="snapshot-label">${escapeHTML(snapshot.label)}</span>
            <span class="snapshot-date">${escapeHTML(snapshot.date)}</span>
        </button>
    `).join("");

    return nav;
}

function findSnapshot(id) {
    return SNAPSHOTS.find((snapshot) => snapshot.id === id);
}

function getSnapshotFromHash() {
    const id = location.hash.slice(1);

    return findSnapshot(id) ? id : DEFAULT_SNAPSHOT;
}

function showSnapshot(id) {
    const snapshot = findSnapshot(id) || findSnapshot(DEFAULT_SNAPSHOT);

    snapshotNav.querySelectorAll(".snapshot").forEach((button) => {
        button.setAttribute("aria-pressed", button.dataset.snapshot === snapshot.id);
    });

    if (snapshot.id === DEFAULT_SNAPSHOT) {
        history.replaceState(null, "", location.pathname + location.search);
    } else {
        history.replaceState(null, "", "#" + snapshot.id);
    }

    loadPredictions(snapshot);
}

async function loadPredictions(snapshot) {
    const thisLoad = ++loadCount;
    let data;

    currentFile = snapshot.file;

    try {
        const response = await fetch(snapshot.file, { cache: "no-cache" });

        if (response.status === 404) {
            if (thisLoad === loadCount) {
                showMissingSnapshot(snapshot);
            }
            return;
        }

        if (!response.ok) {
            throw new Error(response.status + " " + response.statusText);
        }

        data = await response.json();
    } catch (error) {
        if (thisLoad === loadCount) {
            showLoadError(error);
        }
        return;
    }

    if (thisLoad !== loadCount) {
        return;
    }

    if (!data || typeof data !== "object") {
        data = {};
    }

    clearCards();

    fillSiteInfo(data.site);
    renderCategories(data.categories);

    categories = document.querySelectorAll(".category");

    setupPhotos();
    markResults();

    fitNames();
    document.fonts.ready.then(fitNames);
}

function clearCards() {
    featured.innerHTML = "";
    grid.innerHTML = "";

    emptyText.hidden = true;
    emptyText.textContent = "";

    categories = [];
}

function showMissingSnapshot(snapshot) {
    clearCards();

    emptyText.textContent =
        `The ${snapshot.label} snapshot hasn't been saved yet. `

    emptyText.hidden = false;

    scoreText.textContent = "Snapshot not saved yet";
    document.getElementById("siteUpdated").textContent = "";
}

function showLoadError(error) {
    console.error(`Couldn't load ${currentFile}:`, error);

    clearCards();

    emptyText.textContent =
        `Couldn't load ${currentFile} (${error.message}). ` +
        "Check the file is valid JSON. If you opened index.html straight from a folder, run it from a local server instead.";

    emptyText.hidden = false;

    scoreText.textContent = "";
    document.getElementById("siteUpdated").textContent = "";
}

function fillSiteInfo(site) {
    if (!site || typeof site !== "object") {
        site = {};
    }

    document.getElementById("siteEdition").textContent = cleanText(site.edition) || "Academy Awards";
    document.getElementById("siteCeremony").textContent = cleanText(site.ceremony) || "TBA";
    document.getElementById("siteAuthor").textContent = cleanText(site.author) || "me";

    document.getElementById("siteUpdated").textContent =
        cleanText(site.updated) ? "Updated " + cleanText(site.updated) + "." : "";
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

    const kind = raw.kind === "person" ? "person" : "film";

    return {
        title: cleanText(raw.title) || "Category " + (index + 1),
        featured: raw.featured === true,
        kind: kind,
        showDetail: raw.showDetail !== false,
        confidence: CONFIDENCE_LABELS[confidence] ? confidence : "",
        pick: cleanText(raw.pick),
        shouldWin: cleanText(raw.shouldWin),
        why: cleanText(raw.why),
        winner: cleanText(raw.winner),
        nominees: Array.isArray(raw.nominees) ? raw.nominees.map((nominee) => cleanNominee(nominee, kind)) : []
    };
}

function cleanNominee(raw, kind) {
    if (typeof raw === "string") {
        raw = { name: raw };
    }

    if (!raw || typeof raw !== "object") {
        raw = {};
    }

    const name = cleanText(raw.name);
    const detail = cleanText(raw.detail);

    return {
        name: name,
        detail: isPlaceholder(detail) ? "" : detail,
        photo: photoPath(name, kind)
    };
}

function isPlaceholder(value) {
    return /^(tba|tbd|n\/a|\[.*\])$/i.test(value);
}

function photoPath(name, kind) {
    // Placeholders like "TBA", "[Nominee 2]" or an empty name get no photo
    if (!name || isPlaceholder(name)) {
        return "";
    }

    const slug = slugify(name);

    if (!slug) {
        return "";
    }

    return PHOTO_FOLDERS[kind] + "/" + slug + PHOTO_EXTENSION;
}

function slugify(text) {
    return String(text)
        .replace(/[¼-¾⅐-⅟]/g, (fraction) => "-" + fraction)
        .normalize("NFKD")
        .replace(/[̀-ͯ]/g, "")
        .toLowerCase()
        .replace(/[øæœßłđðþı]/g, (letter) => SPECIAL_LETTERS[letter])
        .replace(/['’‘`]/g, "")
        .replace(/&/g, " and ")
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");
}

function renderCategories(list) {
    if (!Array.isArray(list) || list.length === 0) {
        emptyText.textContent = `No categories in ${currentFile} yet.`;
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
            console.error(`Skipped category ${index + 1} in ${currentFile}:`, error);
        }
    });
}

function buildFeatured(category) {
    const pick = findPick(category) || { name: category.pick, photo: photoPath(category.pick, category.kind) };

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
    const pick = findPick(category) || { name: category.pick, detail: "", photo: photoPath(category.pick, category.kind) };
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

    const showDetail = category.showDetail && nominee.detail && !isPick(nominee, category);
    const comma = showDetail ? `<span class="comma">,</span>` : "";
    const detail = showDetail ? ` <span class="detail">${escapeHTML(nominee.detail)}</span>` : "";

    return `
        <li class="nominee${isPick(nominee, category) ? " pick" : ""}" data-name="${escapeHTML(nominee.name)}" title="${escapeHTML(label)}">
            ${buildPhoto(nominee.photo, name)}

            <span class="name${nominee.name ? "" : " tba"}"><span class="who">${escapeHTML(name)}${comma}</span>${detail}</span>
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
