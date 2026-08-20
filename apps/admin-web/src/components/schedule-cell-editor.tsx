"use client";

import { useState } from "react";
import { ActionForm } from "@/components/action-form";
import { CreateDialog } from "@/components/create-dialog";

type ShiftOption = { id: string; label: string };

export function ScheduleCellEditor({
  action,
  employeeId,
  employeeName,
  workDate,
  currentEntryCount,
  shifts,
  labels,
}: {
  action: (formData: FormData) => Promise<void>;
  employeeId: string;
  employeeName: string;
  workDate: string;
  currentEntryCount: number;
  shifts: ShiftOption[];
  labels: Record<string, string>;
}) {
  const [entryType, setEntryType] = useState("shift");
  const [shiftTemplateId, setShiftTemplateId] = useState(shifts[0]?.id ?? "");
  const [startTime, setStartTime] = useState("09:00");
  const [endTime, setEndTime] = useState("17:00");
  const customShift = entryType === "shift" && !shiftTemplateId;
  const overnight = customShift && endTime <= startTime;

  return (
    <CreateDialog
      closeLabel={labels.close}
      description={labels.help}
      eyebrow={`${employeeName} · ${workDate}`}
      title={labels.title}
      triggerClassName={`schedule-cell-add${currentEntryCount ? " has-entries" : ""}`}
      triggerLabel={currentEntryCount ? labels.editDay : labels.setShift}
      width="medium"
    >
      <ActionForm
        action={action}
        className="stack schedule-cell-form"
        errorMessage={labels.failed}
        pendingMessage={labels.saving}
        successMessage={labels.saved}
      >
        <input name="employeeId" type="hidden" value={employeeId} />
        <input name="workDate" type="hidden" value={workDate} />
        <div
          className="schedule-entry-type-picker"
          role="radiogroup"
          aria-label={labels.entryType}
        >
          {[
            ["shift", labels.shift],
            ["off", labels.off],
            ["leave", labels.leave],
            ["training", labels.training],
            ["assignment", labels.assignment],
          ].map(([value, label]) => (
            <label
              className={entryType === value ? "selected" : ""}
              key={value}
            >
              <input
                checked={entryType === value}
                name="entryType"
                onChange={() => setEntryType(value)}
                type="radio"
                value={value}
              />
              <span>{label}</span>
            </label>
          ))}
        </div>

        {entryType === "shift" ? (
          <>
            <div
              className="shift-choice-grid"
              role="radiogroup"
              aria-label={labels.shiftTemplate}
            >
              {shifts.map((shift) => (
                <label
                  className={shiftTemplateId === shift.id ? "selected" : ""}
                  key={shift.id}
                >
                  <input
                    checked={shiftTemplateId === shift.id}
                    name="shiftTemplateId"
                    onChange={() => setShiftTemplateId(shift.id)}
                    type="radio"
                    value={shift.id}
                  />
                  <span>
                    <strong>{shift.label}</strong>
                    <small>{labels.predefined}</small>
                  </span>
                </label>
              ))}
              <label
                className={!shiftTemplateId ? "selected custom" : "custom"}
              >
                <input
                  checked={!shiftTemplateId}
                  name="shiftTemplateId"
                  onChange={() => setShiftTemplateId("")}
                  type="radio"
                  value=""
                />
                <span>
                  <strong>{labels.customShift}</strong>
                  <small>{labels.customShiftHelp}</small>
                </span>
              </label>
            </div>
            {customShift ? (
              <div className="form-grid custom-shift-fields">
                <div className="field">
                  <label>{labels.startTime}</label>
                  <input
                    className="input"
                    name="customStartTime"
                    onChange={(event) => setStartTime(event.target.value)}
                    required
                    type="time"
                    value={startTime}
                  />
                </div>
                <div className="field">
                  <label>{labels.endTime}</label>
                  <input
                    className="input"
                    name="customEndTime"
                    onChange={(event) => setEndTime(event.target.value)}
                    required
                    type="time"
                    value={endTime}
                  />
                </div>
                <div className="field">
                  <label>{labels.breakMinutes}</label>
                  <input
                    className="input"
                    defaultValue="0"
                    max="480"
                    min="0"
                    name="breakMinutes"
                    type="number"
                  />
                </div>
                <input
                  name="endDayOffset"
                  type="hidden"
                  value={overnight ? "1" : "0"}
                />
                <div
                  className={`overnight-indicator${overnight ? " active" : ""}`}
                >
                  <span aria-hidden="true">↗</span>
                  <div>
                    <strong>
                      {overnight ? labels.overnight : labels.sameDay}
                    </strong>
                    <small>{labels.overnightHelp}</small>
                  </div>
                </div>
              </div>
            ) : null}
            {currentEntryCount ? (
              <div className="assignment-mode">
                <label>
                  <input
                    defaultChecked
                    name="assignmentMode"
                    type="radio"
                    value="replace"
                  />{" "}
                  <span>
                    <strong>{labels.replaceDay}</strong>
                    <small>{labels.replaceDayHelp}</small>
                  </span>
                </label>
                <label>
                  <input name="assignmentMode" type="radio" value="append" />{" "}
                  <span>
                    <strong>{labels.addSplit}</strong>
                    <small>{labels.addSplitHelp}</small>
                  </span>
                </label>
              </div>
            ) : (
              <input name="assignmentMode" type="hidden" value="replace" />
            )}
          </>
        ) : (
          <>
            <input name="assignmentMode" type="hidden" value="replace" />
            <div className="notice compact-notice">{labels.nonShiftHelp}</div>
          </>
        )}

        <div className="field">
          <label>{labels.notes}</label>
          <input className="input" name="notes" placeholder={labels.optional} />
        </div>
        <button className="button" type="submit">
          {currentEntryCount ? labels.saveDay : labels.assign}
        </button>
      </ActionForm>
    </CreateDialog>
  );
}
