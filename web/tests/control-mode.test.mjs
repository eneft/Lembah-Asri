import test from 'node:test';
import assert from 'node:assert/strict';
import {
  CONTROL_MODE_KEY, parseControlPreference, resolveControlMode
} from '../src/ui/controlMode.ts';

test('stored preference is validated and never trusts arbitrary values',()=>{
  assert.equal(CONTROL_MODE_KEY,'lembah-asri:control-mode:v1');
  for(const expected of ['auto','desktop','tablet'])
    assert.equal(parseControlPreference(expected),expected);
  for(const invalid of [null,'', 'phone','desktop ', 'TABLET'])
    assert.equal(parseControlPreference(invalid),'auto');
});

test('explicit mode always wins on hybrid touch and desktop devices',()=>{
  for(const coarse of [false,true])for(const compact of [false,true]){
    assert.equal(resolveControlMode('desktop',coarse,compact),'desktop');
    assert.equal(resolveControlMode('tablet',coarse,compact),'tablet');
    assert.equal(resolveControlMode('auto',coarse,compact),
      coarse||compact?'tablet':'desktop');
  }
});
