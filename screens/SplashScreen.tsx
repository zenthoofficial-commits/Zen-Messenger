
import React from 'react';
import { MessageCircle } from 'lucide-react';
import { motion } from 'framer-motion';

const SplashScreen: React.FC = () => {
  return (
    <div className="w-full h-full flex flex-col items-center justify-center bg-base-tan dark:bg-gray-900 text-text-primary dark:text-gray-100">
      <motion.div
        animate={{
          scale: [1, 1.2, 1, 1.1, 1],
          rotate: [0, 10, -10, 0, 0],
        }}
        transition={{
          duration: 1.5,
          ease: "easeInOut",
          repeat: Infinity,
          repeatDelay: 1
        }}
      >
        <MessageCircle className="text-accent-brand" size={64}/>
      </motion.div>
      <motion.h1 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.2 }}
        className="text-4xl font-bold mt-4"
      >
        ZenChat
      </motion.h1>
      <motion.p 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5, delay: 0.4 }}
        className="text-lg mt-2 text-text-primary/70 dark:text-gray-400"
      >
        Talk Freely. Feel Secure.
      </motion.p>
    </div>
  );
};

export default SplashScreen;