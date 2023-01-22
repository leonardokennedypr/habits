import dayjs from "dayjs";
import { FastifyInstance } from "fastify";
import { z } from "zod";
import { prisma } from "./lib/prisma";

export async function appRoutes(app: FastifyInstance) {
  app.post("/habits", async (request) => {
    const createHabitBody = z.object({
      title: z.string(),
      weekDays: z.array(z.number().min(0).max(6)),
    });

    const { title, weekDays } = createHabitBody.parse(request.body);

    const today = dayjs().startOf("day").toDate();

    await prisma.habit.create({
      data: {
        title,
        created_at: today,
        weekDays: {
          create: weekDays.map((weekDay) => {
            return {
              week_day: weekDay,
            };
          }),
        },
      },
    });
  });

  app.get("/day", async (request) => {
    const getDayParams = z.object({
      date: z.coerce.date(),
    });

    const { date } = getDayParams.parse(request.query);
    const parsedDate = dayjs(date).startOf('day')
    const weekDay = dayjs(parsedDate).get('day');

    // todos os hábitos possíveis
    const possibleHabits = await prisma.habit.findMany({
        where: {
            created_at: {
                lte: date
            },
            weekDays: {
                some: {
                    week_day: weekDay
                }
            }
        }
    })

    // hábitos que já foram completados
    const day = await prisma.day.findUnique({
        where: {
            date: parsedDate.toDate()
        },
        include: {
            dayHabits: true
        }
    });

    const completedHabits = day?.dayHabits.map(dayHabit => dayHabit.habit_id) ?? [];

    return {
        possibleHabits,
        completedHabits
    }

  });

  app.patch('/habits/:id/toggle', async (request) => {
    const toggleHabitParams = z.object({
      id: z.string().uuid()
    })

    const { id } = toggleHabitParams.parse(request.params);
    const today = dayjs().startOf('day').toDate();

    let day = await prisma.day.findUnique({
      where: {
        date: today
      }
    })

    if (!day) {
      day = await prisma.day.create({
        data: {
          date: today
        }
      })
    }

    // Verificando se o hábito do dia já está completo
    const dayHabit = await prisma.dayHabit.findUnique({
      where: {
        day_id_habit_id: {
          day_id: day.id,
          habit_id: id
        }
      }
    })

    if (dayHabit) {
      // Remover a marcação de completo
      await prisma.dayHabit.delete({
        where: {
          id: dayHabit.id
        }
      })
    } else {
      // Completar o hábito do dia
      await prisma.dayHabit.create({
        data: {
          day_id: day.id,
          habit_id: id
        }
      })
    }
  })

  app.get('/summary', async () => {
    // [ { date: 17/01, amount: 5, completed: 1 }, { date: 18/01, amount: 2, completed: 2 }, {} ]

    // const summary = await prisma.$queryRaw`
    //   SELECT 
    //     D.id,
    //     D.date,
    //     cast(count(DH.day_id) as float) as completed,
    //     cast(count(HWD.habit_id) as float) as amount
    //   FROM days D
    //   INNER JOIN day_habits DH 
    //     ON DH.day_id = D.id
    //   INNER JOIN habits H 
    //     ON H.id = DH.habit_id
    //   INNER JOIN habit_week_days HWD 
    //     ON HWD.habit_id = H.id
    //   WHERE 
    //     HWD.week_day = cast(strftime('%w', D.date/1000.0, 'unixepoch') as int)
    //     AND H.created_at <= D.date
    //   GROUP BY D.id
    // `

    const summary = await prisma.$queryRaw`
      SELECT 
        D.id,
        D.date,
        (
          SELECT
          cast(count(*) as float) 
          FROM day_habits DH
          WHERE DH.day_id = D.id
        ) as completed,
        (
          SELECT
          cast(count(*) as float)
          FROM habit_week_days HWD
          INNER JOIN habits H 
            ON H.id = HWD.habit_id
          WHERE 
            HWD.week_day = cast(strftime('%w', D.date/1000.0, 'unixepoch') as int)
            AND H.created_at <= D.date
        )as amount
      FROM days D
    `

    return summary;
  })
}
