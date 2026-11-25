// Telegram copy for welcome-bonus outcomes. This module is deliberately pure:
// it can only describe a result supplied by the bonus domain, never infer a grant.
export function formatWelcomeBonusMessage(outcome) {
  switch (outcome?.status) {
    case 'granted': {
      const details = String(outcome.bonus?.message || '').trim();
      return details
        ? '🎁 Приветственный бонус начислен:\n' + details
        : 'Не удалось подтвердить состав начисленного бонуса. Проверьте профиль в приложении.';
    }
    case 'already_granted':
      return 'Приветственный бонус уже начислялся ранее. Проверьте доступные подарки в профиле.';
    case 'disabled':
      return 'Приветственный бонус сейчас не начислен: эта возможность отключена в настройках.';
    case 'ineligible':
      return 'Приветственный бонус не начислен: профиль не подходит под условия акции.';
    case 'unknown':
    default:
      return 'Не удалось подтвердить начисление приветственного бонуса. Проверьте профиль в приложении или обратитесь к сотруднику.';
  }
}
