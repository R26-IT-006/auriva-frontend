jest.mock('../api/client',()=>({post:jest.fn(),get:jest.fn()}));
import client from '../api/client';
import {requireStudentId,submitWordAttempt,fetchWordProgress} from './wordApi';
test('missing identity never falls back to student zero',()=>{expect(()=>requireStudentId({})).toThrow();expect(()=>requireStudentId({sid:0})).toThrow();});
test('authoritative attempt response is returned from one POST',async()=>{client.post.mockResolvedValueOnce({data:{attempt:{score:61,passed:true}}});await expect(submitWordAttempt({student:{sid:4},actionId:'a',word:'cat'})).resolves.toEqual({score:61,passed:true});expect(client.post).toHaveBeenCalledTimes(1);});
test('progress comes only from backend',async()=>{client.get.mockResolvedValueOnce({data:{c:[{word:'cat',status:{A:'correct'}}]}});await expect(fetchWordProgress({sid:4})).resolves.toHaveProperty('c');});
