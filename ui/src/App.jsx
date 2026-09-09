import { useEffect, useMemo, useState } from 'react';

const API_BASE = 'http://127.0.0.1:8000';
const CHAT_STORAGE_KEY = 'personal-ai-scheduler-chats';
const INITIAL_GREETING = {
  from: 'ai',
  text: 'Good afternoon, Hamza. How can I help you organize your day?'
};

const createChat = () => ({
  id: `chat-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  title: 'New conversation',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
  messages: [{ ...INITIAL_GREETING }]
});

const loadChatState = () => {
  try {
    const saved = JSON.parse(localStorage.getItem(CHAT_STORAGE_KEY) || 'null');
    if (saved?.chats?.length && saved.activeChatId) {
      return saved;
    }
  } catch (error) {
    console.error('Could not load saved chats:', error);
  }

  const chat = createChat();
  return { chats: [chat], activeChatId: chat.id };
};

const titleFromMessages = (messages) => {
  const firstUserMessage = messages.find((message) => message.from === 'user');
  if (!firstUserMessage) return 'New conversation';
  const title = firstUserMessage.text.replace(/\s+/g, ' ').trim();
  return title.length > 38 ? `${title.slice(0, 38).trim()}...` : title;
};

const chatDateGroup = (value) => {
  const date = new Date(value);
  const today = new Date();
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  const startOfDate = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const daysAgo = Math.round((startOfToday - startOfDate) / 86400000);
  if (daysAgo === 0) return 'Today';
  if (daysAgo === 1) return 'Yesterday';
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
};

const navItems = [
  ['dashboard', 'Dashboard', '⌂'], ['calendar', 'Calendar', '□'], ['appointments', 'Appointments', '▣'],
  ['tasks', 'Tasks', '✓'], ['assistant', 'AI Assistant', '✦'], ['settings', 'Settings', '⚙'],
];

const days = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const formatDate = (date) =>
  date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric'
  });

const formatTime = (time) => {
  const [hours, minutes] = time.split(':').map(Number);
  const suffix = hours >= 12 ? 'PM' : 'AM';

  return `${hours % 12 || 12}:${String(minutes).padStart(2, '0')} ${suffix}`;
};

const dateKey = (date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const todayKey = dateKey(new Date());

const formatTaskDate = (value) =>
  new Date(`${value}T12:00:00`).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });

const eventEndMinutes = (event) => {
  const [hours, minutes] = event.start.split(':').map(Number);
  return hours * 60 + minutes + Number(event.duration || 0);
};

const findConflicts = (items) => items.flatMap((event, index) =>
  items.slice(index + 1)
    .filter((other) => event.date === other.date)
    .filter((other) => {
      const start = event.start.split(':').map(Number);
      const otherStart = other.start.split(':').map(Number);
      const startMinutes = start[0] * 60 + start[1];
      const otherStartMinutes = otherStart[0] * 60 + otherStart[1];
      return startMinutes < eventEndMinutes(other) && otherStartMinutes < eventEndMinutes(event);
    })
    .map((other) => ({ first: event, second: other }))
);

const freeTimeLabel = (items) => {
  const occupied = items.reduce((total, event) => total + Number(event.duration || 0), 0);
  const freeMinutes = Math.max(0, 9 * 60 - occupied);
  return `${Math.floor(freeMinutes / 60)}h ${freeMinutes % 60}m`;
};


function Icon({ children }) {
  return <span className="icon" aria-hidden="true">{children}</span>;
}


export default function App() {
  const [page, setPage] = useState('dashboard');
  const [theme, setTheme] = useState(() => localStorage.getItem('scheduler-theme') || 'light');

  const [events, setEvents] = useState([]);
  const [appointments, setAppointments] = useState([]);
  const [tasks, setTasks] = useState([]);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalType, setModalType] = useState('appointment');
  const [viewMode, setViewMode] = useState('Month');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState(todayKey);
  const [notice, setNotice] = useState('');
  const [chatState, setChatState] = useState(loadChatState);
  const activeChat = chatState.chats.find((chat) => chat.id === chatState.activeChatId) || chatState.chats[0];

  const [messages, setMessages] = useState(() => activeChat.messages);

  const [isLoading, setIsLoading] = useState(false);


  const dayEvents = useMemo(
    () => events.filter((event) => event.date === todayKey),
    [events]
  );

  const refreshData = async () => {
    const [eventsResponse, appointmentsResponse, tasksResponse] = await Promise.all([
      fetch(`${API_BASE}/calendar/events`),
      fetch(`${API_BASE}/appointments`),
      fetch(`${API_BASE}/tasks`)
    ]);

    if (!eventsResponse.ok || !appointmentsResponse.ok || !tasksResponse.ok) {
      throw new Error('Unable to load scheduler data');
    }

    const [eventData, appointmentData, taskData] = await Promise.all([
      eventsResponse.json(),
      appointmentsResponse.json(),
      tasksResponse.json()
    ]);
    setEvents(eventData.events);
    setAppointments(appointmentData.appointments);
    setTasks(taskData.tasks);
  };

  useEffect(() => {
    refreshData().catch((error) => console.error('Scheduler data error:', error));
    const interval = window.setInterval(() => {
      refreshData().catch((error) => console.error('Scheduler refresh error:', error));
    }, 30000);
    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    localStorage.setItem('scheduler-theme', theme);
  }, [theme]);

  useEffect(() => {
    localStorage.setItem(CHAT_STORAGE_KEY, JSON.stringify(chatState));
  }, [chatState]);

  const toggleTheme = () => {
    setTheme((current) => current === 'light' ? 'dark' : 'light');
  };

  const saveActiveMessages = (nextMessages) => {
    setMessages(nextMessages);
    setChatState((current) => ({
      ...current,
      chats: current.chats.map((chat) =>
        chat.id === current.activeChatId
          ? {
              ...chat,
              title: titleFromMessages(nextMessages),
              updatedAt: new Date().toISOString(),
              messages: nextMessages
            }
          : chat
      )
    }));
  };

  const startNewChat = () => {
    const chat = createChat();
    setChatState((current) => ({
      chats: [chat, ...current.chats],
      activeChatId: chat.id
    }));
    setMessages(chat.messages);
  };

  const selectChat = (chatId) => {
    const chat = chatState.chats.find((item) => item.id === chatId);
    if (!chat) return;
    setChatState((current) => ({ ...current, activeChatId: chatId }));
    setMessages(chat.messages);
  };

  const deleteChat = (chatId) => {
    const remainingChats = chatState.chats.filter((chat) => chat.id !== chatId);
    if (!remainingChats.length) {
      startNewChat();
      return;
    }

    const nextActiveId = chatId === chatState.activeChatId
      ? remainingChats[0].id
      : chatState.activeChatId;
    const nextActiveChat = remainingChats.find((chat) => chat.id === nextActiveId);
    setChatState({ chats: remainingChats, activeChatId: nextActiveId });
    setMessages(nextActiveChat.messages);
  };


  const showNotice = (text) => {
    setNotice(text);

    window.setTimeout(
      () => setNotice(''),
      2800
    );
  };


  const openAdd = (type = 'appointment') => {
    setModalType(type);
    setModalOpen(true);
  };


  const addEvent = async (event) => {
    const endpoint = event.type === 'task' ? '/tasks' : '/appointments';
    const body = event.type === 'task'
      ? event
      : { title: event.title, date: event.date, time: event.start };

    try {
      const response = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (!response.ok) throw new Error('Unable to save schedule item');
      await refreshData();
      setModalOpen(false);
      showNotice(`${event.title} added to your schedule`);
    } catch (error) {
      console.error('Save schedule item error:', error);
      showNotice('Could not save that schedule item');
    }
  };


  // Send a message to the real FastAPI backend.
  const replyToAssistant = async (text) => {
    if (!text.trim() || isLoading) return;

    const userMessage = {
      from: 'user',
      text: text.trim()
    };

    // Add the user's message immediately.
    const messagesWithUser = [...messages, userMessage];
    saveActiveMessages(messagesWithUser);

    setIsLoading(true);

    try {
      // Convert the existing visible conversation
      // into the format expected by FastAPI.
      const history = messages.map((message) => ({
        role:
          message.from === 'ai'
            ? 'assistant'
            : 'user',
        content: message.text
      }));

      const response = await fetch(
        'http://127.0.0.1:8000/chat',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            message: text.trim(),
            history
          })
        }
      );

      if (!response.ok) {
        throw new Error(
          `Server returned ${response.status}`
        );
      }

      const data = await response.json();

      saveActiveMessages([
        ...messagesWithUser,
        { from: 'ai', text: data.response }
      ]);

    } catch (error) {
      console.error(
        'Assistant connection error:',
        error
      );

      saveActiveMessages([
        ...messagesWithUser,
        {
          from: 'ai',
          text: 'I could not connect to the scheduling server. Please make sure the FastAPI server is running.'
        }
      ]);

    } finally {
      refreshData().catch((error) => console.error('Post-assistant refresh error:', error));
      setIsLoading(false);
    }
  };


  return (
    <div className="app-shell">

      <aside className="sidebar">

        <div className="brand">
          <div className="brand-mark">✦</div>

          <div>
            <strong>Personal AI</strong>
            <span>Scheduler</span>
          </div>
        </div>


        <div className="workspace-label">
          WORKSPACE
        </div>


        <nav>
          {navItems
            .slice(0, 5)
            .map(([id, label, icon]) => (
              <button
                key={id}
                className={
                  page === id
                    ? 'nav-item active'
                    : 'nav-item'
                }
                onClick={() => setPage(id)}
              >
                <Icon>{icon}</Icon>

                <span>{label}</span>

                {id === 'assistant' && (
                  <em>New</em>
                )}
              </button>
            ))}
        </nav>


        <div className="sidebar-bottom">

          <div className="workspace-label">
            PREFERENCES
          </div>

          {navItems
            .slice(5)
            .map(([id, label, icon]) => (
              <button
                key={id}
                className={
                  page === id
                    ? 'nav-item active'
                    : 'nav-item'
                }
                onClick={() => setPage(id)}
              >
                <Icon>{icon}</Icon>
                <span>{label}</span>
              </button>
            ))}


          <div className="user-card">

            <div className="avatar">
              HM
            </div>

            <div>
              <strong>Hamza Malik</strong>
              <span>Personal workspace</span>
            </div>

            <span className="more">
              •••
            </span>

          </div>

        </div>

      </aside>


      <main className="main-content">

        <header className="topbar">

          <div className="mobile-brand">

            <div className="brand-mark">
              ✦
            </div>

            <strong>
              Personal AI
            </strong>

          </div>


          <div className="topbar-tools">

            <button
              className="icon-button"
              aria-label="Toggle theme"
              aria-pressed={theme === 'dark'}
              title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              onClick={toggleTheme}
            >
              {theme === 'dark' ? '☾' : '☼'}
            </button>

            <button
              className="icon-button notification"
              aria-label="Notifications"
            >
              ♢
              <i />
            </button>

            <div className="avatar small">
              HM
            </div>

          </div>

        </header>


        {page === 'dashboard' && (
          <Dashboard
            events={dayEvents}
            appointments={appointments}
            onAdd={openAdd}
            onNavigate={setPage}
          />
        )}


        {page === 'calendar' && (
          <Calendar
            events={events}
            viewMode={viewMode}
            setViewMode={setViewMode}
            selectedDate={selectedDate}
            setSelectedDate={setSelectedDate}
            currentMonth={currentMonth}
            setCurrentMonth={setCurrentMonth}
            onAdd={openAdd}
          />
        )}


        {page === 'appointments' && (
          <Appointments
            appointments={appointments}
            onAdd={openAdd}
            onNotice={showNotice}
            setAppointments={setAppointments}
            onRefresh={refreshData}
          />
        )}


        {page === 'tasks' && (
          <Tasks
            tasks={tasks}
            setTasks={setTasks}
            onAdd={() => openAdd('task')}
            onRefresh={refreshData}
          />
        )}


        {page === 'assistant' && (
          <Assistant
            messages={messages}
            onSend={replyToAssistant}
            isLoading={isLoading}
            chats={chatState.chats}
            activeChatId={chatState.activeChatId}
            onNewChat={startNewChat}
            onSelectChat={selectChat}
            onDeleteChat={deleteChat}
          />
        )}


        {page === 'settings' && (
          <Settings />
        )}

      </main>


      {modalOpen && (
        <AddEventModal
          type={modalType}
          onClose={() => setModalOpen(false)}
          onSave={addEvent}
        />
      )}


      {notice && (
        <div className="toast">
          <span>✓</span>
          {notice}
        </div>
      )}

    </div>
  );
}


function PageHeader({
  eyebrow,
  title,
  description,
  action
}) {
  return (
    <div className="page-header">

      <div>

        <div className="eyebrow">
          {eyebrow}
        </div>

        <h1>{title}</h1>

        {description && (
          <p>{description}</p>
        )}

      </div>

      {action}

    </div>
  );
}


function Button({
  children,
  variant = 'primary',
  onClick,
  type = 'button'
}) {
  return (
    <button
      type={type}
      className={`button ${variant}`}
      onClick={onClick}
    >
      {children}
    </button>
  );
}


function Stat({
  label,
  value,
  detail,
  icon,
  tone
}) {
  return (
    <div className="stat-card">

      <div className={`stat-icon ${tone}`}>
        {icon}
      </div>

      <div>

        <span>{label}</span>
        <strong>{value}</strong>
        <small>{detail}</small>

      </div>

    </div>
  );
}


function Dashboard({
  events,
  appointments,
  onAdd,
  onNavigate
}) {
  const conflicts = findConflicts(events);
  const upcomingAppointments = appointments.filter((item) => item.date >= todayKey);

  return (
    <div className="page">

      <PageHeader
        eyebrow={formatDate(new Date())}
        title="Good afternoon, Hamza"
        description="Here is the shape of your day. Keep the important things moving."
        action={
          <Button
            onClick={() =>
              onAdd('appointment')
            }
          >
            ＋ Add event
          </Button>
        }
      />


      <div className="stats-grid">

        <Stat
          label="Today's events"
          value={events.length}
          detail={`${events.filter((event) => event.type === 'task').length} tasks, ${events.filter((event) => event.type === 'appointment').length} appointments`}
          icon="◷"
          tone="blue"
        />

        <Stat
          label="Upcoming appointments"
          value={upcomingAppointments.length}
          detail={upcomingAppointments.length ? `Next on ${formatTaskDate(upcomingAppointments[0].date)}` : 'Nothing scheduled ahead'}
          icon="▣"
          tone="coral"
        />

        <Stat
          label="Free time"
          value={freeTimeLabel(events)}
          detail="Across today's working hours"
          icon="✧"
          tone="mint"
        />

      </div>


      <div className="dashboard-grid">

        <section className="panel schedule-panel">

          <div className="panel-heading">

            <div>

              <h2>Today's schedule</h2>

              <p>
                {formatDate(new Date())}
              </p>

            </div>

            <button
              className="text-button"
              onClick={() =>
                onNavigate('calendar')
              }
            >
              View calendar <span>→</span>
            </button>

          </div>


          <div className="timeline">

            {events.length ? events.map((event) => (
              <TimelineEvent key={event.id} event={event} />
            )) : <div className="empty-day">No events scheduled today.</div>}

          </div>


          {conflicts.length > 0 && <div className="conflict">

            <div className="conflict-icon">
              !
            </div>

            <div>

              <strong>
                Schedule conflict
              </strong>

              <p>
                {conflicts[0].first.title} overlaps with {conflicts[0].second.title}.
              </p>

            </div>

            <button
              onClick={() =>
                onNavigate('calendar')
              }
            >
              Review
            </button>

          </div>}

        </section>


        <section className="panel upcoming-panel">

          <div className="panel-heading">

            <div>

              <h2>
                Upcoming appointments
              </h2>

              <p>
                Your next commitments
              </p>

            </div>

            <button className="more-button">
              •••
            </button>

          </div>


          {upcomingAppointments
            .slice(0, 3)
            .map((item) => (
              <AppointmentRow
                key={item.id}
                item={item}
              />
            ))}

          {!upcomingAppointments.length && <div className="empty-day">No upcoming appointments.</div>}


          <button
            className="view-all"
            onClick={() =>
              onNavigate('appointments')
            }
          >
            View all appointments
            <span>→</span>
          </button>

        </section>

      </div>


      <section className="quick-section">

        <div className="section-title">

          <div>

            <div className="eyebrow">
              GET THINGS DONE
            </div>

            <h2>
              Quick actions
            </h2>

          </div>

        </div>


        <div className="quick-grid">

          <button
            className="quick-card"
            onClick={() => onNavigate('assistant')}
          >
            <span className="quick-icon coral-bg">
              ＋
            </span>

            <strong>
              Plan with AI
            </strong>

            <small>
              Find a time that works
            </small>

            <span className="arrow">
              ↗
            </span>

          </button>


          <button
            className="quick-card"
            onClick={() => onNavigate('assistant')}
          >
            <span className="quick-icon blue-bg">
              ✓
            </span>

            <strong>
              Find free time
            </strong>

            <small>
              Make space for the little things
            </small>

            <span className="arrow">
              ↗
            </span>

          </button>


          <button
            className="quick-card"
            onClick={() =>
              onNavigate('assistant')
            }
          >
            <span className="quick-icon violet-bg">
              ✦
            </span>

            <strong>
              Ask AI
            </strong>

            <small>
              Let your assistant handle it
            </small>

            <span className="arrow">
              ↗
            </span>

          </button>

        </div>

      </section>

    </div>
  );
}


function TimelineEvent({ event }) {
  return (
    <div className="timeline-row">

      <div className="timeline-time">
        {formatTime(event.start)}
      </div>

      <div
        className={`timeline-line ${event.color}`}
      >
        <div className="timeline-dot" />
      </div>

      <div className="timeline-event">

        <div
          className={`event-accent ${event.color}`}
        />

        <div>

          <strong>
            {event.title}
          </strong>

          <span>
            {event.type === 'appointment'
              ? 'Appointment'
              : 'Task'}
          </span>

        </div>

        <small>
          {event.duration} min
        </small>

      </div>

    </div>
  );
}


function AppointmentRow({ item }) {
  return (
    <div className="appointment-row">

      <div
        className={`appointment-symbol ${item.color}`}
      >
        {item.service.charAt(0)}
      </div>

      <div className="appointment-info">

        <strong>
          {item.service}
        </strong>

        <span>
          {item.date} · {item.time}
        </span>

      </div>

      <span
        className={`status ${item.status.toLowerCase()}`}
      >
        {item.status}
      </span>

    </div>
  );
}


function Calendar({
  events,
  viewMode,
  setViewMode,
  selectedDate,
  setSelectedDate,
  currentMonth,
  setCurrentMonth,
  onAdd
}) {
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const monthLabel = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const firstDay = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthDays = Array.from({ length: firstDay + daysInMonth }, (_, index) => index < firstDay ? null : index - firstDay + 1);
  const selectedDateParts = selectedDate.split('-').map(Number);
  const selectedDateObject = new Date(selectedDateParts[0], selectedDateParts[1] - 1, selectedDateParts[2]);
  const selectedEvents = events.filter((event) => event.date === selectedDate);
  const conflicts = findConflicts(events);

  return (
    <div className="page">

      <PageHeader
        eyebrow="YOUR TIME, AT A GLANCE"
        title="Calendar"
        description="See your tasks and appointments in one calm view."
        action={
          <Button
            onClick={() =>
              onAdd('appointment')
            }
          >
            ＋ Add event
          </Button>
        }
      />


      <div className="calendar-toolbar">

        <div className="month-switcher">

          <button onClick={() => {
            const nextMonth = new Date(year, month - 1, 1);
            setCurrentMonth(nextMonth);
            setSelectedDate(`${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`);
          }}>‹</button>

          <strong>
            {monthLabel}
          </strong>

          <button onClick={() => {
            const nextMonth = new Date(year, month + 1, 1);
            setCurrentMonth(nextMonth);
            setSelectedDate(`${nextMonth.getFullYear()}-${String(nextMonth.getMonth() + 1).padStart(2, '0')}-01`);
          }}>›</button>

        </div>


        <div className="view-toggle">

          {['Month', 'Week', 'Day'].map(
            (mode) => (
              <button
                key={mode}
                className={
                  viewMode === mode
                    ? 'selected'
                    : ''
                }
                onClick={() =>
                  setViewMode(mode)
                }
              >
                {mode}
              </button>
            )
          )}

        </div>

      </div>


      <section className="calendar-layout">

        <div className="panel calendar-panel">

          <div className="calendar-grid weekdays">

            {days.map((day) => (
              <span key={day}>
                {day}
              </span>
            ))}

          </div>


          <div className="calendar-grid dates">

            {monthDays.map((day, index) => {

              if (!day) return <span key={`empty-${index}`} className="date-cell empty-date" />;

              const dayEvents =
                events.filter(
                  (event) =>
                    event.date === `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                );

              return (
                <button
                  key={day}
                  className={`date-cell ${
                    dateKey(new Date()) === `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`
                      ? 'today'
                      : ''
                  } ${
                    `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}` === selectedDate
                      ? 'selected-day'
                      : ''
                  }`}
                  onClick={() => setSelectedDate(`${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`)}
                >

                  <span>{day}</span>

                  {dayEvents.map(
                    (event) => (
                      <small
                        key={event.id}
                        className={event.type}
                      >
                        {event.title}
                      </small>
                    )
                  )}

                </button>
              );

            })}

          </div>

        </div>


        <aside className="panel day-detail">

          <div className="panel-heading">

            <div>

              <div className="eyebrow">
                SELECTED DAY
              </div>

              <h2>
                {selectedDateObject.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
              </h2>

              <p>
                {selectedDateObject.getFullYear() === year && selectedDateObject.getMonth() === month
                  ? monthLabel
                  : selectedDateObject.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
              </p>

            </div>

            <button className="more-button">
              •••
            </button>

          </div>


          <div className="day-detail-list">

            {selectedEvents.map((event) => (
                <TimelineEvent
                  key={event.id}
                  event={event}
                />
              ))}


            {!selectedEvents.length && (
              <div className="empty-day">

                No events scheduled for this day.

                <br />

                <button
                  className="text-button"
                  onClick={() =>
                    onAdd('task')
                  }
                >
                  Add something
                </button>

              </div>
            )}

          </div>


          <div className="legend">

            <span>
              <i className="legend-dot appointment" />
              Appointment
            </span>

            <span>
              <i className="legend-dot task" />
              Task
            </span>

          </div>

        </aside>

      </section>


      {conflicts.length > 0 && <div className="conflict-banner">

        <div className="conflict-icon">
          !
        </div>

        <div>

          <strong>
            Schedule conflict
          </strong>

          <span>
            {conflicts[0].first.title} overlaps with {conflicts[0].second.title}.
          </span>

        </div>

        <div className="conflict-actions">

          <button
            onClick={() =>
              onAdd('appointment')
            }
          >
            Reschedule
          </button>

          <button>
            Keep both
          </button>

        </div>

      </div>}

    </div>
  );
}


function Appointments({
  appointments,
  onAdd,
  onNotice,
  setAppointments,
  onRefresh
}) {
  return (
    <div className="page">

      <PageHeader
        eyebrow="YOUR COMMITMENTS"
        title="Appointments"
        description="Keep every booking in one easy-to-scan place."
        action={
          <Button
            onClick={() =>
              onAdd('appointment')
            }
          >
            ＋ Book appointment
          </Button>
        }
      />


      <div className="appointment-list">

        {appointments.map((item) => (

          <article
            className="appointment-card"
            key={item.id}
          >

            <div
              className={`service-mark ${item.color}`}
            >
              {item.service.charAt(0)}
            </div>


            <div className="appointment-card-main">

              <div className="card-topline">

                <span
                  className={`status ${item.status.toLowerCase()}`}
                >
                  {item.status}
                </span>

                <button className="more-button">
                  •••
                </button>

              </div>


              <h2>
                {item.service}
              </h2>

              <p>
                {item.provider}
              </p>


              <div className="appointment-meta">

                <span>
                  ▣ {item.date}
                </span>

                <span>
                  ◷ {item.time}
                </span>

              </div>

            </div>


            <div className="card-actions">

              <button
                onClick={async () => {
                  const newDate = window.prompt('New date (YYYY-MM-DD)', item.date);
                  const newTime = window.prompt('New time (HH:MM)', item.time);
                  if (!newDate || !newTime) return;
                  const response = await fetch(`${API_BASE}/appointments/${item.event_id}`, {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ date: newDate, time: newTime })
                  });
                  if (!response.ok) return onNotice('Could not reschedule appointment');
                  await onRefresh();
                  onNotice(`${item.service} rescheduled`);
                }}
              >
                Reschedule
              </button>


              <button
                className="cancel"
                onClick={async () => {
                  const response = await fetch(`${API_BASE}/appointments/${item.event_id}`, { method: 'DELETE' });
                  if (!response.ok) return onNotice('Could not cancel appointment');
                  await onRefresh();
                  onNotice(`${item.service} cancelled`);
                }}
              >
                Cancel
              </button>

            </div>

          </article>

        ))}

      </div>

    </div>
  );
}


function Tasks({
  tasks,
  setTasks,
  onAdd,
  onRefresh
}) {
  return (
    <div className="page">

      <PageHeader
        eyebrow="PERSONAL CHECKLIST"
        title="Tasks"
        description="Make room for the things that keep your week running well."
        action={
          <Button onClick={onAdd}>
            ＋ Add task
          </Button>
        }
      />


      <section className="panel tasks-panel">

        <div className="panel-heading">

          <div>

            <h2>
              All tasks
            </h2>

            <p>
              {tasks.filter(
                (task) => !task.done
              ).length}{' '}
              open tasks
            </p>

          </div>

          <div className="task-filter">
            All <span>⌄</span>
          </div>

        </div>


        {tasks.map((task) => (

          <div
            className={`task-row ${
              task.done
                ? 'completed'
                : ''
            }`}
            key={task.id}
          >

            <button
              className="check-button"
              onClick={async () => {
                const response = await fetch(`${API_BASE}/tasks/${task.id}`, {
                  method: 'PATCH',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ done: !task.done })
                });
                if (response.ok) await onRefresh();
              }}
            >
              {task.done ? '✓' : ''}
            </button>


            <div className="task-info">

              <strong>
                {task.title}
              </strong>

              <span>
                {formatTaskDate(task.date)} · {formatTime(task.start)} ·{' '}
                {task.duration} min
              </span>

            </div>


            <span className="reminder">
              ◷ {task.reminder}
            </span>


            <button className="more-button">
              •••
            </button>

          </div>

        ))}

        {!tasks.length && <div className="empty-day">You're all caught up.</div>}

      </section>

    </div>
  );
}


function Assistant({
  messages,
  onSend,
  isLoading,
  chats,
  activeChatId,
  onNewChat,
  onSelectChat,
  onDeleteChat
}) {
  const [input, setInput] =
    useState('');
  const previousChats = chats.filter((chat) =>
    chat.messages.some((message) => message.from === 'user')
  );


  const submit = async (event) => {

    event.preventDefault();

    if (!input.trim() || isLoading) {
      return;
    }

    const message = input;

    setInput('');

    await onSend(message);
  };


  return (
    <div className="page assistant-page">

      <PageHeader
        eyebrow="YOUR PERSONAL COPILOT"
        title="AI Assistant"
        description="Turn a thought into a scheduled plan."
        action={
          <Button onClick={onNewChat}>
            ＋ New chat
          </Button>
        }
      />


      <section className="assistant-shell">

        <div className="assistant-intro">

          <div className="assistant-orb">
            ✦
          </div>

          <h2>
            What can I help you schedule?
          </h2>

          <p>
            Ask me to find time, book an
            appointment, or organize your day.
          </p>


          <div className="suggestions">

            <button
              onClick={() =>
                onSend(
                  'What does my afternoon look like?'
                )
              }
              disabled={isLoading}
            >
              What does my afternoon look like?
            </button>


            <button
              onClick={() =>
                onSend(
                  'Find time for a workout tomorrow'
                )
              }
              disabled={isLoading}
            >
              Find time for a workout tomorrow
            </button>

          </div>

          <div className="chat-history">
            <div className="chat-history-heading">
              <span className="eyebrow">CHAT HISTORY</span>
              <span>{previousChats.length}</span>
            </div>

            {previousChats.length === 0 && (
              <div className="chat-history-empty">No previous chats yet.</div>
            )}

            {Object.entries(
              previousChats.reduce((groups, chat) => {
                const group = chatDateGroup(chat.updatedAt);
                groups[group] = [...(groups[group] || []), chat];
                return groups;
              }, {})
            ).map(([group, groupChats]) => (
              <div className="chat-history-group" key={group}>
                <span className="chat-history-date">{group}</span>
                {groupChats.map((chat) => (
                  <div
                    className={`chat-history-item ${chat.id === activeChatId ? 'active' : ''}`}
                    key={chat.id}
                  >
                    <button
                      className="chat-history-select"
                      onClick={() => onSelectChat(chat.id)}
                    >
                      {chat.title}
                    </button>
                    <button
                      className="chat-history-delete"
                      aria-label={`Delete ${chat.title}`}
                      title="Delete chat"
                      onClick={() => onDeleteChat(chat.id)}
                    >
                      ×
                    </button>
                  </div>
                ))}
              </div>
            ))}
          </div>

        </div>


        <div className="chat-window">

          <div className="chat-header">

            <div className="assistant-avatar">
              ✦
            </div>

            <div>

              <strong>
                Scheduler AI
              </strong>

              <span>
                {isLoading
                  ? 'Thinking...'
                  : 'Ready when you are'}
              </span>

            </div>

            <span className="online-dot" />

          </div>


          <div className="messages">

            {messages.map(
              (message, index) => (

                <div
                  className={`message ${message.from}`}
                  key={`${message.text}-${index}`}
                >

                  <div className="message-avatar">

                    {message.from === 'ai'
                      ? '✦'
                      : 'HM'}

                  </div>


                  <div>

                    <span className="message-label">

                      {message.from === 'ai'
                        ? 'Scheduler AI'
                        : 'You'}

                    </span>


                    <p>
                      {message.text}
                    </p>

                  </div>

                </div>

              )
            )}


            {isLoading && (

              <div className="message ai">

                <div className="message-avatar">
                  ✦
                </div>

                <div>

                  <span className="message-label">
                    Scheduler AI
                  </span>

                  <p>
                    Thinking...
                  </p>

                </div>

              </div>

            )}

          </div>


          <form
            className="chat-input"
            onSubmit={submit}
          >

            <input
              value={input}
              onChange={(event) =>
                setInput(event.target.value)
              }
              placeholder="Ask me anything about your schedule..."
              disabled={isLoading}
            />


            <button
              aria-label="Send message"
              disabled={isLoading}
            >
              ↑
            </button>

          </form>

        </div>

      </section>

    </div>
  );
}


function Settings() {
  return (
    <div className="page">

      <PageHeader
        eyebrow="WORKSPACE PREFERENCES"
        title="Settings"
        description="Shape how your scheduler works for you."
      />


      <section className="panel settings-panel">

        <div className="setting-row">

          <div>

            <strong>
              Profile
            </strong>

            <span>
              Hamza Malik · Pakistan Standard Time
            </span>

          </div>

          <button className="outline-button">
            Edit
          </button>

        </div>


        <div className="setting-row">

          <div>

            <strong>
              Default reminders
            </strong>

            <span>
              15 minutes before each event
            </span>

          </div>

          <button className="toggle on">
            <i />
          </button>

        </div>


        <div className="setting-row">

          <div>

            <strong>
              Conflict alerts
            </strong>

            <span>
              Show overlap warnings in your calendar
            </span>

          </div>

          <button className="toggle on">
            <i />
          </button>

        </div>


        <div className="setting-row">

          <div>

            <strong>
              Connected services
            </strong>

            <span>
              Ready for Google Calendar connection later
            </span>

          </div>

          <button className="outline-button">
            Connect
          </button>

        </div>

      </section>

    </div>
  );
}


function AddEventModal({
  type,
  onClose,
  onSave
}) {
  const [form, setForm] =
    useState({
      type,
      title: '',
      date: todayKey,
      start: '18:00',
      duration: '60',
      reminder: '15 minutes before'
    });


  const update = (
    key,
    value
  ) => {
    setForm((current) => ({
      ...current,
      [key]: value
    }));
  };


  const submit = (event) => {

    event.preventDefault();

    if (form.title.trim()) {

      onSave({
        ...form,
        title: form.title.trim(),
        duration: Number(form.duration)
      });

    }

  };


  return (
    <div
      className="modal-backdrop"
      onMouseDown={onClose}
    >

      <div
        className="modal"
        onMouseDown={(event) =>
          event.stopPropagation()
        }
      >

        <div className="modal-header">

          <div>

            <div className="eyebrow">
              NEW SCHEDULE ITEM
            </div>

            <h2>
              Add event
            </h2>

          </div>


          <button
            className="close-button"
            onClick={onClose}
          >
            ×
          </button>

        </div>


        <form onSubmit={submit}>

          <div className="type-tabs">

            <button
              type="button"
              className={
                form.type === 'appointment'
                  ? 'selected'
                  : ''
              }
              onClick={() =>
                update(
                  'type',
                  'appointment'
                )
              }
            >
              ▣ Appointment
            </button>


            <button
              type="button"
              className={
                form.type === 'task'
                  ? 'selected'
                  : ''
              }
              onClick={() =>
                update(
                  'type',
                  'task'
                )
              }
            >
              ✓ Task
            </button>

          </div>


          <label>

            {form.type === 'appointment'
              ? 'Service'
              : 'Task name'}

            <input
              required
              value={form.title}
              onChange={(event) =>
                update(
                  'title',
                  event.target.value
                )
              }
              placeholder={
                form.type === 'appointment'
                  ? 'e.g. Personal training'
                  : 'e.g. Review project notes'
              }
            />

          </label>


          <div className="form-grid">

            <label>

              Date

              <input
                type="date"
                value={form.date}
                onChange={(event) =>
                  update(
                    'date',
                    event.target.value
                  )
                }
              />

            </label>


            <label>

              Start time

              <input
                type="time"
                value={form.start}
                onChange={(event) =>
                  update(
                    'start',
                    event.target.value
                  )
                }
              />

            </label>


            <label>

              Duration

              <select
                value={form.duration}
                onChange={(event) =>
                  update(
                    'duration',
                    event.target.value
                  )
                }
              >

                <option value="30">
                  30 minutes
                </option>

                <option value="45">
                  45 minutes
                </option>

                <option value="60">
                  1 hour
                </option>

                <option value="90">
                  1 hour 30 minutes
                </option>

              </select>

            </label>


            <label>

              Reminder

              <select
                value={form.reminder}
                onChange={(event) =>
                  update(
                    'reminder',
                    event.target.value
                  )
                }
              >

                <option>
                  15 minutes before
                </option>

                <option>
                  30 minutes before
                </option>

                <option>
                  1 hour before
                </option>

                <option>
                  No reminder
                </option>

              </select>

            </label>

          </div>


          <div className="modal-actions">

            <button
              type="button"
              className="outline-button"
              onClick={onClose}
            >
              Cancel
            </button>


            <Button type="submit">
              Save event
            </Button>

          </div>

        </form>

      </div>

    </div>
  );
}