(() => {
  const openButton = document.getElementById('deleteAccountButton');
  const status = document.getElementById('deleteAccountStatus');
  if (!openButton || !status) return;
  const dialog = document.createElement('dialog');
  dialog.setAttribute('aria-labelledby', 'accountDeletionTitle');
  dialog.style.cssText = 'max-width:420px;width:calc(100% - 48px);padding:28px;border:1px solid #bbb;border-radius:20px;color:#171717;background:#fff;';
  dialog.innerHTML = '<h2 id="accountDeletionTitle"></h2><p data-warning></p><p data-status role="status"></p><div style="display:flex;gap:20px;margin-top:24px"><button type="button" data-cancel></button><button type="button" data-delete style="color:#b42318"></button></div>';
  document.body.append(dialog);
  const cancel = dialog.querySelector('[data-cancel]');
  const remove = dialog.querySelector('[data-delete]');
  const progress = dialog.querySelector('[data-status]');
  let pending = false;
  const en = () => currentLanguage === 'en';
  openButton.addEventListener('click', () => {
    status.textContent = '';
    if (currentUser?.role !== 'general') {
      status.textContent = en() ? 'Sign in to the account you want to delete.' : '삭제할 계정으로 로그인해 주세요.';
      return;
    }
    dialog.querySelector('h2').textContent = en() ? 'Delete your account?' : '계정을 삭제할까요?';
    dialog.querySelector('[data-warning]').textContent = en()
      ? 'Your profile, all saved and published songs, and visit records will be permanently deleted. This cannot be undone.'
      : '프로필, 저장한 곡과 공개한 곡, 방문 기록이 영구 삭제됩니다. 삭제 후에는 복구할 수 없어요.';
    cancel.textContent = en() ? 'Cancel' : '취소';
    remove.textContent = en() ? 'Delete permanently' : '영구 삭제';
    progress.textContent = '';
    dialog.showModal();
    cancel.focus();
  });
  cancel.addEventListener('click', () => { if (!pending) dialog.close(); });
  dialog.addEventListener('cancel', event => { if (pending) event.preventDefault(); });
  remove.addEventListener('click', async () => {
    if (pending || currentUser?.role !== 'general') return;
    const deletingId = currentUserId;
    pending = true;
    cancel.disabled = remove.disabled = true;
    progress.textContent = en() ? 'Deleting…' : '삭제 중…';
    try {
      const { data, error } = await supabaseClient.functions.invoke('delete-account', {
        body: { confirm: 'DELETE_MY_ACCOUNT' }
      });
      if (error || data?.deleted !== true) throw new Error('Deletion failed');
      stopComposeTimeTracking();
      await supabaseClient.auth.signOut({ scope: 'local' }).catch(() => {});
      for (const key of [USER_SESSION_KEY, USER_ID_KEY, STORAGE_KEY,
        COMPOSE_TIME_STORAGE_PREFIX + deletingId, COMPOSE_DAILY_STORAGE_PREFIX + deletingId]) {
        localStorage.removeItem(key);
      }
      currentUser = null;
      currentUserId = null;
      location.reload();
    } catch {
      progress.textContent = en()
        ? 'Could not confirm deletion. Please retry or contact hongyena1130@gmail.com.'
        : '삭제 완료를 확인하지 못했어요. 다시 시도하거나 hongyena1130@gmail.com으로 문의해 주세요.';
    } finally {
      pending = false;
      cancel.disabled = remove.disabled = false;
    }
  });
})();
