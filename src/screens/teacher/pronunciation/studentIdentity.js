export function getStudentIdentifier(student) {
  return student?.sid ?? student?.id ?? student?.student_id ?? null;
}
