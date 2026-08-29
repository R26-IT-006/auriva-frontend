import { teacherApi } from "../../../../../api/teacher";
import { getStudentIdentifier } from "./studentIdentity.js";

// The pronunciation flow used to be entirely client-side: the store's
// `startSession` only reset local state, so the backend `sessions` table
// never got a row and the teacher dashboard's "Recent Activity" list stayed
// frozen on whatever rows happened to exist. These two helpers open and
// close the real backend session around the flow.
//
// Both are deliberately best-effort: a teaching session must never fail to
// start (or refuse to end) because the activity log could not be written.

let activeStudentId = null;

export async function beginTeachingSession(student) {
  const studentId = getStudentIdentifier(student);
  if (!studentId) return;

  activeStudentId = studentId;

  try {
    await teacherApi.startSession(studentId);
  } catch (error) {
    // 409 means a session for this child is already open — an earlier one
    // that never got closed (app killed mid-session, crash). That row is
    // reused as this session, and the end call below will close it, so this
    // is a normal outcome rather than a failure worth interrupting for.
    if (error.status !== 409) {
      console.log("Unable to open teaching session:", error.message);
    }
  }
}

export async function endTeachingSession(student) {
  const studentId = getStudentIdentifier(student) ?? activeStudentId;
  if (!studentId) return;

  activeStudentId = null;

  try {
    await teacherApi.endSession(studentId);
  } catch (error) {
    // 404 = nothing open for this child (already ended, or the start call
    // never landed). Either way there is nothing left to close.
    if (error.status !== 404) {
      console.log("Unable to close teaching session:", error.message);
    }
  }
}
