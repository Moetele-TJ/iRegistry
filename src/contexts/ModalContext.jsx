//📄 src/contexts/ModalContext.jsx
import React, { createContext, useContext, useState, useCallback } from "react";
import ConfirmModal from "../components/ConfirmModal.jsx";

const ModalContext = createContext(null);

export function ModalProvider({ children }) {
  const [modalState, setModalState] = useState({
    isOpen: false,
    props: {},
  });

  const close = useCallback(() => {
    setModalState({ isOpen: false, props: {} });
  }, []);

  const confirm = useCallback((options) => {
    return new Promise((resolve, reject) => {
      setModalState({
        isOpen: true,
        props: {
          ...options,
          mode: "confirm",
          onConfirm: async () => {
            try {
              if (options.onConfirm) {
                await options.onConfirm();
              }
              resolve(true);
            } catch (err) {
              reject(err);
            }
          },
          onClose: close,
        },
      });
    });
  }, [close]);

  const alert = useCallback((options) => {
    return new Promise((resolve) => {
      setModalState({
        isOpen: true,
        props: {
          ...options,
          mode: "alert",
          confirmLabel: options.confirmLabel || "OK",
          onConfirm: () => resolve(true),
          onClose: close,
        },
      });
    });
  }, [close]);

  return (
    <ModalContext.Provider value={{ confirm, alert }}>
      {children}

      <ConfirmModal
        isOpen={modalState.isOpen}
        {...modalState.props}
      />
    </ModalContext.Provider>
  );
}

export function useModal() {
  const context = useContext(ModalContext);
  if (!context) {
    throw new Error("useModal must be used inside ModalProvider");
  }
  return context;
}