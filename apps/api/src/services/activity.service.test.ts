import { describe,it,expect,vi } from 'vitest';
vi.mock('../coach/repository.js',()=>({assertScope:vi.fn(async()=>{}),getTransactions:vi.fn()}));
import { getTransactions } from '../coach/repository.js';
import { searchActivity } from './activity.service.js';
const query={scope:{mode:'accounts',accountIds:['a'],cardIds:[]},search:'shop',period:'all',direction:'all',status:'all',category:'all',channel:'all',transactionType:'all',currency:'INR',sort:'amount-desc',page:2,pageSize:1};
describe('server-side Activity pagination',()=>{
 it('summarizes all matching rows but only returns one page',async()=>{
  vi.mocked(getTransactions).mockResolvedValue({rows:['100','300','200'].map((amount,i)=>({id:String(i),kind:'account',accountId:'a',cardId:null,amount,currency:'INR',direction:'debit',status:'completed',category:'shopping',merchant:'Shop',description:'Purchase',transactionAt:'2026-09-01T00:00:00Z',sourceEnvironment:'demo',dataAsOf:'2026-09-02T00:00:00Z',ownTransfer:false,cardRepayment:false})),truncated:false});
  const result=await searchActivity('u',query);
  expect(result.items.map(i=>i.amount)).toEqual(['200']);expect(result.totalItems).toBe(3);expect(result.summary.accountDebits).toBe('600.00');expect(result.page).toBe(2);
  expect(getTransactions).toHaveBeenCalledWith('u',expect.objectContaining({filters:expect.objectContaining({search:'shop'})}),expect.anything(),expect.objectContaining({allStatuses:true,scopeMode:'accounts'}));
 });
 it('rejects invalid filters and date ranges',async()=>{
  await expect(searchActivity('u',{...query,pageSize:1000})).rejects.toThrow();
  await expect(searchActivity('u',{...query,fromDate:'2026-09-20',toDate:'2026-09-01'})).rejects.toThrow('Invalid date range');
 });
});
