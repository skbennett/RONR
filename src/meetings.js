document.addEventListener("DOMContentLoaded", () => {
    // Wait for data manager to be available
    if (typeof window.dataManager === 'undefined') {
        setTimeout(() => {
            document.dispatchEvent(new Event('DOMContentLoaded'));
        }, 100);
        return;
    }

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
        const allMeetings = window.dataManager.getAllMeetings();

        // Sort chronologically
        allMeetings.sort((a, b) => new Date(`${a.date}T${a.time}`) - new Date(`${b.date}T${b.time}`));

        container.innerHTML = "";

        allMeetings.forEach((meeting) => {
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
                const newJoinedStatus = !meeting.joined;
                window.dataManager.updateMeeting(meeting.id, { joined: newJoinedStatus });
                renderMeetings();
            });

            // Remove button
            const removeBtn = card.querySelector(".remove-btn");
            removeBtn.addEventListener("click", () => {
                if (meeting.createdBy && meeting.createdBy !== 'system') {
                    // User-created meeting - can be deleted
                    if (confirm(`Are you sure you want to delete "${meeting.title}"?`)) {
                        window.dataManager.deleteMeeting(meeting.id);
                        renderMeetings();
                    }
                } else {
                    // Original meeting - just hide temporarily
                    card.style.display = 'none';
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

        // Add meeting using data manager
        window.dataManager.addMeeting({
            title: title,
            date: dateInput,
            time: timeInput
        });

        renderMeetings();

        // Clear form
        document.getElementById("new-title").value = "";
        document.getElementById("new-date").value = "";
        document.getElementById("new-time").value = "";
    });
});
