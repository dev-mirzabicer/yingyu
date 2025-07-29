import { prisma } from '@/lib/db';
import { TeacherSettings } from '@prisma/client';
import { z } from 'zod';
import { UpdateTeacherSettingsSchema } from '../schemas';

type UpdateSettingsInput = z.infer<typeof UpdateTeacherSettingsSchema>;

/**
 * Service responsible for managing teacher-specific data and settings.
 */
export const TeacherService = {
  /**
   * Retrieves a teacher's settings. If settings do not exist, it creates
   * and returns the default settings in a single, atomic 'upsert' operation.
   *
   * @param teacherId The UUID of the teacher.
   * @returns A promise that resolves to the TeacherSettings object.
   */
  async getSettings(teacherId: string): Promise<TeacherSettings> {
    return prisma.teacherSettings.upsert({
      where: { teacherId },
      update: {},
      create: {
        teacherId,
      },
    });
  },

  /**
   * Updates a teacher's settings.
   *
   * @param teacherId The UUID of the teacher.
   * @param settingsData The validated data for updating the settings.
   * @returns A promise that resolves to the updated TeacherSettings object.
   */
  async updateSettings(
    teacherId: string,
    settingsData: UpdateSettingsInput
  ): Promise<TeacherSettings> {
    // The `upsert` ensures that we can update settings even if the teacher
    // has never accessed them before.
    return prisma.teacherSettings.upsert({
      where: { teacherId },
      update: settingsData,
      create: {
        teacherId,
        ...settingsData,
      },
    });
  },
};

