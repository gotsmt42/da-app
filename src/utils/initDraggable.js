import { Draggable } from "@fullcalendar/interaction";

export function initExternalEvents(containerId) {
  const container = document.getElementById(containerId);
  if (!container) return;
  new Draggable(container, {
    itemSelector: ".fc-event",
    eventData: (el) => ({
      title: el.innerText.trim()
    })
  });
}
