import toast from 'react-hot-toast';

// Success toast
export const showSuccess = (message) => {
  return toast.success(message, {
    duration: 3000,
    position: 'top-right',
  });
};

// Error toast
export const showError = (message) => {
  return toast.error(message, {
    duration: 4000,
    position: 'top-right',
  });
};

// Info toast
export const showInfo = (message) => {
  return toast(message, {
    duration: 3000,
    position: 'top-right',
    icon: 'ℹ️',
  });
};

// Loading toast
export const showLoading = (message = 'Loading...') => {
  return toast.loading(message, {
    position: 'top-right',
  });
};

// Promise toast (for async operations)
export const showPromise = (promise, messages) => {
  return toast.promise(promise, messages, {
    position: 'top-right',
  });
};

// Custom toast
export const showCustom = (message, type = 'default') => {
  const config = {
    duration: 3000,
    position: 'top-right',
  };

  switch (type) {
    case 'success':
      return toast.success(message, config);
    case 'error':
      return toast.error(message, config);
    case 'loading':
      return toast.loading(message, config);
    default:
      return toast(message, config);
  }
};
