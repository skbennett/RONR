export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  // If it's a YYYY-MM-DD string, parse it directly to avoid timezone issues
  if (typeof dateStr === 'string' && dateStr.match(/^\d{4}-\d{2}-\d{2}$/)) {
    const [year, month, day] = dateStr.split('-');
    return new Date(year, month - 1, day).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  }
  // Otherwise treat it as an ISO timestamp
  const dateObj = new Date(dateStr);
  return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const formatTime = (timeStr) => {
  if (!timeStr) return 'N/A';
  const [hourStr, minuteStr] = timeStr.split(":");
  if (!hourStr || !minuteStr) return 'N/A';
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute.toString().padStart(2, "0")} ${ampm}`;
};

export const formatDateTime = (dateStr, timeStr) => {
  const date = formatDate(dateStr);
  const time = formatTime(timeStr);
  if (date === 'N/A' && time === 'N/A') return 'N/A';
  if (date === 'N/A') return time;
  if (time === 'N/A') return date;
  return `${date} ${time}`;
};

export const formatCreatedAt = (createdAtStr) => {
  if (!createdAtStr) return 'N/A';
  const dateObj = new Date(createdAtStr);
  return dateObj.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" });
};

export default { formatDate, formatTime, formatDateTime, formatCreatedAt };
