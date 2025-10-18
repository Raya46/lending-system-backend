let io;

export const initializeSocket = (socketInstance) => {
  io = socketInstance;

  io.on("connection", (socket) => {
    console.log("user connected: ", socket.id);

    socket.on("join_student_room", (nim) => {
      socket.join(`student_${nim}`);
      console.log(`student ${nim} joined room`);

      socket.emit("room_joined", {
        room: `student_${nim}`,
        message: "Success joined student room",
      });
    });

    socket.on("join_admin_room", () => {
      socket.join("admin_room");
      console.log("admin joined");

      socket.emit("room_joined", {
        room: "admin_room",
        message: "Success joined admin room",
      });
    });

    socket.on("disconnect", () => {
      console.log("user disconnected", socket.id);
    });
  });
};

export const emitToStudent = (nim, event, data) => {
  if (io) {
    io.to(`student_${nim}`).emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
};

export const emitToAdmins = (event, data) => {
  if (io) {
    io.to("admin_room").emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
};

export const emitToAll = (event, data) => {
  if (io) {
    io.emit(event, {
      ...data,
      timestamp: new Date().toISOString(),
    });
  }
};

export const joinStudentRoom = (nim) => {
  if (io) {
    console.log(nim);
  }
};
