export const formatDate = (dateStr) => {
  if (!dateStr) return 'N/A';
  const dateObj = new Date(dateStr);
  return dateObj.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
};

export const formatTime = (timeStr) => {
  if (!timeStr) return 'N/A';
  const [hourStr, minuteStr] = timeStr.split(":");
  let hour = parseInt(hourStr, 10);
  const minute = parseInt(minuteStr, 10);
  const ampm = hour >= 12 ? "PM" : "AM";
  hour = hour % 12 || 12;
  return `${hour}:${minute.toString().padStart(2, "0")} ${ampm}`;
};

export default { formatDate, formatTime };
