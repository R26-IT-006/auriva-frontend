import client from '../api/client';
import { ENDPOINTS } from '../constants/api';
export function requireStudentId(student){const id=Number(student?.sid);if(!Number.isInteger(id)||id<=0)throw new Error('A valid student is required');return id;}
export function newActionId(){return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g,c=>{const r=Math.random()*16|0,v=c==='x'?r:(r&3|8);return v.toString(16);});}
// Word-layout-feedback task: the backend response is {duplicate, attempt, child_feedback}
// — child_feedback ('size'|'spacing'|'both'|null) sits alongside attempt, not inside it.
// Merged into one flat object so existing callers reading e.g. authoritative.score keep
// working unchanged, while authoritative.child_feedback is now also preserved instead of
// silently discarded. This is the server's own authoritative advisory — never a value the
// client computed or guessed.
export async function submitWordAttempt({student,actionId,...payload}){const studentId=requireStudentId(student);const {data}=await client.post(ENDPOINTS.WORD_ATTEMPT,{student_id:studentId,action_id:actionId,...payload});return {...data.attempt,child_feedback:data.child_feedback??null};}
export async function saveWordActivity({student,word,activity,status}){const studentId=requireStudentId(student);await client.post(ENDPOINTS.WORD_ACTIVITY,{student_id:studentId,word,activity,status});}
export async function fetchWordProgress(student){const id=requireStudentId(student);return (await client.get(ENDPOINTS.WORD_PROGRESS(id))).data;}
export async function fetchWordReport(student){const id=requireStudentId(student);return (await client.get(ENDPOINTS.WORD_REPORT(id))).data;}
