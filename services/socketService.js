let io;

export const initializeSocket = (socketInstance) => {
  io = socketInstance;

  io.on("connection", (socket) => {
    console.log("user connected: ", socket.id);

    socket.on("join_student_room", (nim) => {
      socket.join(`student_${nim}`);
      console.log(`student ${nim} joined room`);
    });

    socket.on("join_admin_room", () => {
      socket.join("admin_room");
      console.log("admin joined");
    });

    socket.on("disconnect", () => {
      console.log("user disconnected", socket.id);
    });
  });
};

export const emitToStudent = (nim, event, data) => {
  if (io) {
    io.to(`student_${nim}`).emit(event, data);
  }
};

export const emitToAdmins = (event, data) => {
  if (io) {
    io.to("admin_room").emit(event, data);
  }
};

export const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, data);
  }
};
