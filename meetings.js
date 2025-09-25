document.addEventListener("DOMContentLoaded", () => {
    const STORAGE_KEY = "allMeetings";

    // Original meetings (always present)
    const originalMeetings = [
        { title: "Board Meeting", date: "2025-09-25", time: "15:00", joined: false },
        { title: "Finance Committee", date: "2025-09-27", time: "10:00", joined: false },
        { title: "Annual General Assembly", date: "2025-10-02", time: "13:00", joined: false },
        { title: "Project Planning", date: "2025-10-05", time: "16:30", joined: false }
    ];

    // Load user-added meetings from localStorage
    let addedMeetings = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];

    const container = document.querySelector(".meetings-container");

    function formatDate(dateStr) {
        const dateObj = new Date(dateStr);
        return dateObj.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric" });
    }

    function formatTime(timeStr) {
        const [hourStr, minuteStr] = timeStr.split(":");
        let hour = parseInt(hourStr, 10);
        const minute = parseInt(minuteStr, 10);
        const ampm = hour >= 12 ? "PM" : "AM";
        hour = hour % 12 || 12;
        return `${hour}:${minute.toString().padStart(2, "0")} ${ampm}`;
    }

    function renderMeetings() {
        const allMeetings = [...originalMeetings, ...addedMeetings];

        // Sort chronologically
        allMeetings.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

        container.innerHTML = "";

        allMeetings.forEach((meeting, index) => {
            const card = document.createElement("div");
            card.className = "meeting-card";

            card.innerHTML = `
                <div class="meeting-info">
                    <div class="meeting-title">${meeting.title}</div>
                    <div class="meeting-details">Date: ${formatDate(meeting.date)} &nbsp;|&nbsp; Time: ${formatTime(meeting.time)}</div>
                </div>
                <div class="meeting-buttons">
                    <button class="join-btn ${meeting.joined ? "joined" : ""}">${meeting.joined ? "Joined" : "Join"}</button>
                    <button class="remove-btn">Remove</button>
                </div>
            `;

            // Join button
            const joinBtn = card.querySelector(".join-btn");
            joinBtn.addEventListener("click", () => {
                meeting.joined = !meeting.joined;

                // Persist for added meetings only
                if (index >= originalMeetings.length) {
                    addedMeetings[index - originalMeetings.length].joined = meeting.joined;
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(addedMeetings));
                }

                renderMeetings();
            });

            // Remove button
            const removeBtn = card.querySelector(".remove-btn");
            removeBtn.addEventListener("click", () => {
                if (index >= originalMeetings.length) {
                    // Remove from addedMeetings
                    addedMeetings.splice(index - originalMeetings.length, 1);
                    localStorage.setItem(STORAGE_KEY, JSON.stringify(addedMeetings));
                } else {
                    // For original meetings, just hide temporarily by removing from DOM
                    // They will reappear on reload because we don't persist removal
                    container.removeChild(card);
                }
            });

            container.appendChild(card);
        });
    }

    renderMeetings();

    // Add new meeting
    const addBtn = document.getElementById("add-meeting-btn");
    addBtn.addEventListener("click", () => {
        const title = document.getElementById("new-title").value.trim();
        const dateInput = document.getElementById("new-date").value;
        const timeInput = document.getElementById("new-time").value;

        if (!title || !dateInput || !timeInput) {
            alert("Please fill out all fields.");
            return;
        }

        addedMeetings.push({ title, date: dateInput, time: timeInput, joined: false });
        localStorage.setItem(STORAGE_KEY, JSON.stringify(addedMeetings));

        renderMeetings();

        document.getElementById("new-title").value = "";
        document.getElementById("new-date").value = "";
        document.getElementById("new-time").value = "";
    });
});
