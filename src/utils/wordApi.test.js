jest.mock('../api/client',()=>({post:jest.fn(),get:jest.fn()}));
import client from '../api/client';
import {requireStudentId,submitWordAttempt,fetchWordProgress} from './wordApi';
test('missing identity never falls back to student zero',()=>{expect(()=>requireStudentId({})).toThrow();expect(()=>requireStudentId({sid:0})).toThrow();});
test('authoritative attempt response is returned from one POST',async()=>{client.post.mockResolvedValueOnce({data:{attempt:{score:61,passed:true}}});await expect(submitWordAttempt({student:{sid:4},actionId:'a',word:'cat'})).resolves.toEqual({score:61,passed:true,child_feedback:null});expect(client.post).toHaveBeenCalledTimes(1);});
test('progress comes only from backend',async()=>{client.get.mockResolvedValueOnce({data:{c:[{word:'cat',status:{A:'correct'}}]}});await expect(fetchWordProgress({sid:4})).resolves.toHaveProperty('c');});

// Child-feedback task — the backend response is {attempt, child_feedback},
// two siblings, not one nested inside the other. Confirms wordApi actually
// preserves child_feedback instead of silently discarding it (the defect
// this completion pass's section 2 fixes), for every value the backend can
// return, without ever altering the attempt's own score/passed/completion.
test.each(['size', 'spacing', 'both', null])('child_feedback %p is preserved alongside the attempt fields, unchanged', async childFeedback => {
  client.post.mockResolvedValueOnce({ data: { attempt: { score: 80, passed: true, completion_passed: true }, child_feedback: childFeedback } });
  const result = await submitWordAttempt({ student: { sid: 4 }, actionId: 'a', word: 'cat' });
  expect(result.child_feedback).toBe(childFeedback);
  expect(result.score).toBe(80);
  expect(result.passed).toBe(true);
  expect(result.completion_passed).toBe(true);
});

test('a response with no child_feedback key at all (e.g. a duplicate replay) still resolves to null, not undefined', async () => {
  client.post.mockResolvedValueOnce({ data: { attempt: { score: 40, passed: false } } });
  const result = await submitWordAttempt({ student: { sid: 4 }, actionId: 'a', word: 'cat' });
  expect(result.child_feedback).toBeNull();
});
