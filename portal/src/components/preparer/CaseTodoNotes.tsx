// Per-case to-do list + private case notes — preparer dashboard.
// Local state only (example) until migration 0012
// (preparer_case_todos / preparer_case_notes) is applied and wired.
// Case notes are PROVIDER-ONLY: never shown to the client or family.
"use client";

import { useState } from "react";

interface Todo {
  id: string;
  label: string;
  due: string;
  done: boolean;
}

export default function CaseTodoNotes() {
  const [todos, setTodos] = useState<Todo[]>([
    { id: "t1", label: "Review Example Client A bank statement retake", due: "2026-11-19", done: false },
    { id: "t2", label: "Request I-864 joint-sponsor tax transcript", due: "2026-11-20", done: false },
    { id: "t3", label: "Order certified translation — birth certificate ($45/page, locked)", due: "2026-11-21", done: false },
  ]);
  const [newTodo, setNewTodo] = useState("");
  const [newDue, setNewDue] = useState("");
  const [notes, setNotes] = useState<string[]>([
    "Example note (provider-only): client prefers WhatsApp in the evenings.",
  ]);
  const [newNote, setNewNote] = useState("");

  return (
    <section
      aria-labelledby="case-todo-heading"
      className="rounded-lg border border-slate-300 bg-white p-4 shadow-sm"
    >
      <h2 id="case-todo-heading" className="text-lg font-semibold">
        Per-Case To-Do List &amp; Private Case Notes
      </h2>
      <p className="mt-1 text-sm text-slate-600">
        Example Client A — I-130 + I-485. Example data, local only. Notes
        below are provider-only and are never shown to the client or family.
      </p>

      <h3 className="mt-4 text-sm font-semibold">To-do (with due dates)</h3>
      <ul className="mt-2 space-y-2">
        {todos.map((t) => (
          <li key={t.id} className="flex flex-wrap items-center gap-2 rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            <input
              type="checkbox"
              checked={t.done}
              onChange={() =>
                setTodos((ts) => ts.map((x) => (x.id === t.id ? { ...x, done: !x.done } : x)))
              }
              aria-label={`Mark "${t.label}" done`}
            />
            <span className={t.done ? "line-through text-slate-500" : ""}>
              {t.label} — due {t.due}
            </span>
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="text"
          value={newTodo}
          onChange={(e) => setNewTodo(e.target.value)}
          placeholder="New to-do (example)"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <input
          type="date"
          value={newDue}
          onChange={(e) => setNewDue(e.target.value)}
          aria-label="Due date"
          className="rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            if (!newTodo.trim()) return;
            setTodos((ts) => [...ts, { id: `t-${ts.length + 1}`, label: newTodo.trim(), due: newDue || "no due date", done: false }]);
            setNewTodo("");
            setNewDue("");
          }}
          className="rounded bg-blue-600 px-3 py-1 text-sm font-medium text-white"
        >
          Add to-do
        </button>
      </div>

      <h3 className="mt-5 text-sm font-semibold">
        Private case notes — provider-only (never shown to client / family)
      </h3>
      <ul className="mt-2 space-y-1">
        {notes.map((n, i) => (
          <li key={i} className="rounded border border-slate-200 bg-slate-50 px-3 py-2 text-sm">
            {n}
          </li>
        ))}
      </ul>
      <div className="mt-2 flex flex-wrap gap-2">
        <input
          type="text"
          value={newNote}
          onChange={(e) => setNewNote(e.target.value)}
          placeholder="Add a private note (example — provider-only)"
          className="min-w-0 flex-1 rounded border border-slate-300 px-2 py-1 text-sm"
        />
        <button
          type="button"
          onClick={() => {
            if (!newNote.trim()) return;
            setNotes((ns) => [...ns, newNote.trim()]);
            setNewNote("");
          }}
          className="rounded bg-slate-700 px-3 py-1 text-sm font-medium text-white"
        >
          Add note
        </button>
      </div>
      <p className="mt-2 text-xs text-slate-500">
        Notes must stay clerical (what was received, what is missing, what
        was sent). Never write legal advice or legal strategy in a case note.
      </p>
    </section>
  );
}
