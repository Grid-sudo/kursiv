export const roleNames = { admin: 'Администратор', curator: 'Куратор', teacher: 'Учитель', student: 'Ученик' };
export const roleHome = () => '/dashboard';
export const canAuthor = (user, course) => user?.role === 'admin' || (user?.role === 'teacher' && String(course?.createdBy) === String(user._id));
export const initials = user => `${user?.firstName?.[0] || ''}${user?.lastName?.[0] || ''}`.toUpperCase();
